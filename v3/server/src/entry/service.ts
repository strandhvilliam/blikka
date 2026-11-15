import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type EntryCaller, GUEST_TOKEN_PREFIX } from "../auth/EntrySession.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import type { User } from "../contract.ts";
import { Db, transaction } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { ParticipantsService } from "../participants/service.ts";
import { AlreadyEntered, EntryClosed, GuestDetailsRequired, ParticipantNotFound } from "./schemas.ts";

const { participants } = model;

// What a participant sees of their own entry (EntryParticipant).
const entryColumns = {
  id: participants.id,
  competition_id: participants.competitionId,
  name: participants.name,
  email: participants.email,
  created_at: participants.createdAt,
};

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

// Only the hash is stored, so a database leak doesn't hand out guest entries (adr/0004).
const hashToken = async (token: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

// What participants do, as guests or signed in (adr/0004). Every read is scoped to the caller's own entries.
export class EntryService extends Context.Service<EntryService>()("blikka/entry/EntryService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { claimGuestEntries } = yield* ParticipantsService;

    // Without a caller: only published competitions exist here.
    const getPublished = Effect.fn("EntryService.getPublished")(function* (slug: string) {
      const [competition] = yield* Effect.promise(() =>
        db
          .select({
            id: model.competitions.id,
            slug: model.competitions.slug,
            name: model.competitions.name,
            description: model.competitions.description,
            time_zone: model.competitions.timeZone,
            opens_at: model.competitions.opensAt,
            closes_at: model.competitions.closesAt,
          })
          .from(model.competitions)
          .where(
            and(
              eq(model.competitions.slug, slug),
              isNull(model.competitions.deletedAt),
              isNotNull(model.competitions.publishedAt),
            ),
          ),
      );
      if (!competition) return yield* new CompetitionNotFound();
      return competition;
    });

    // Signed in, the entry comes from the account and entering again returns it. A guest gets a
    // token, returned only here.
    const enter = Effect.fn("EntryService.enter")(function* (
      user: User | null,
      competitionId: string,
      guest: { name?: string | undefined; email?: string | undefined },
    ) {
      if (!user && (!guest.name || !guest.email)) return yield* new GuestDetailsRequired();
      const token = user ? null : GUEST_TOKEN_PREFIX + hex(crypto.getRandomValues(new Uint8Array(32)));
      const tokenHash = token ? yield* Effect.promise(() => hashToken(token)) : null;
      // A guest entry made with the user's verified email after they signed in becomes theirs here,
      // by the same rule as at sign-in.
      if (user) yield* claimGuestEntries(user.id);

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          // Shared, so entries don't wait on each other, but an unpublish (FOR UPDATE) waits for them.
          const [competition] = yield* Effect.promise(() =>
            tx
              .select({ closed: sql<boolean>`${model.competitions.closesAt} <= now()` })
              .from(model.competitions)
              .where(
                and(
                  eq(model.competitions.id, competitionId),
                  isNull(model.competitions.deletedAt),
                  isNotNull(model.competitions.publishedAt),
                ),
              )
              .for("share"),
          );
          if (!competition) return yield* new CompetitionNotFound();
          if (competition.closed) return yield* new EntryClosed();

          if (!user) {
            const [created] = yield* Effect.promise(() =>
              tx
                .insert(participants)
                .values({ competitionId, name: guest.name!, email: guest.email!.toLowerCase(), guestTokenHash: tokenHash })
                .onConflictDoNothing()
                .returning(entryColumns),
            );
            if (!created) return yield* new AlreadyEntered();
            return { participant: created, guest_token: token };
          }

          const mine = Effect.promise(() =>
            tx
              .select(entryColumns)
              .from(participants)
              .where(and(eq(participants.competitionId, competitionId), eq(participants.userId, user.id))),
          ).pipe(Effect.map(([row]) => row));
          const existing = yield* mine;
          if (existing) return { participant: existing, guest_token: null };

          const [created] = yield* Effect.promise(() =>
            tx
              .insert(participants)
              // Accounts made with an emailed code have no name.
              .values({ competitionId, userId: user.id, name: user.name || user.email, email: user.email.toLowerCase() })
              .onConflictDoNothing()
              .returning(entryColumns),
          );
          if (created) return { participant: created, guest_token: null };
          // The same user entering twice at once: the other request created it.
          const raced = yield* mine;
          if (!raced) return yield* new AlreadyEntered();
          return { participant: raced, guest_token: null };
        }),
      );
    });

    // Every entry route reads through this: the entries the session's user or the guest token owns.
    const owned = Effect.fn("EntryService.owned")(function* (caller: EntryCaller["Service"]) {
      const tokenHash = caller.guestToken ? yield* Effect.promise(() => hashToken(caller.guestToken!)) : null;
      const owners = [
        caller.user && eq(participants.userId, caller.user.id),
        tokenHash && eq(participants.guestTokenHash, tokenHash),
      ].filter((owner) => !!owner);
      // Neither a session nor a token owns nothing; an empty or() would match every row.
      return and(isNull(participants.deletedAt), owners.length ? or(...owners) : sql`false`);
    });

    const listOwn = Effect.fn("EntryService.listOwn")(function* (caller: EntryCaller["Service"], competitionId?: string) {
      const scope = yield* owned(caller);
      return yield* Effect.promise(() =>
        db
          .select(entryColumns)
          .from(participants)
          .where(and(scope, competitionId ? eq(participants.competitionId, competitionId) : undefined))
          .orderBy(participants.id),
      );
    });

    const requireParticipantOwner = Effect.fn("EntryService.requireParticipantOwner")(function* (
      caller: EntryCaller["Service"],
      id: string,
    ) {
      const scope = yield* owned(caller);
      const [row] = yield* Effect.promise(() =>
        db.select(entryColumns).from(participants).where(and(scope, eq(participants.id, id))),
      );
      if (!row) return yield* new ParticipantNotFound();
      return row;
    });

    return { getPublished, enter, listOwn, requireParticipantOwner };
  }),
}) {
  static readonly layer = Layer.effect(EntryService, EntryService.make).pipe(Layer.provide(ParticipantsService.layer));
}
