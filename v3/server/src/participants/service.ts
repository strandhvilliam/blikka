import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type EntryCaller, GUEST_TOKEN_PREFIX } from "../auth/EntrySession.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import { AlreadyEntered, EntryClosed, GuestDetailsRequired, ParticipantNotFound } from "./schemas.ts";

const { participants } = model;

// What a participant sees of their own entry (entry/schemas.ts).
const entryColumns = {
  id: participants.id,
  competition_id: participants.competitionId,
  name: participants.name,
  email: participants.email,
  created_at: participants.createdAt,
};

const columns = { ...entryColumns, signed_in: sql<boolean>`${participants.userId} is not null` };

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

// Only the hash is stored, so a database leak doesn't hand out guest entries (adr/0004).
const hashToken = async (token: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

export class ParticipantsService extends Context.Service<ParticipantsService>()(
  "blikka/participants/ParticipantsService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const { selectAccessibleOrganizationIds } = yield* PermissionsService;

      // The organizer's view (adr/0006): entries in competitions of organizations the caller can read participants in.
      const list = Effect.fn("ParticipantsService.list")(function* (caller: User, competitionId?: string) {
        const competitions = db
          .select({ id: model.competitions.id })
          .from(model.competitions)
          .where(
            and(
              inArray(model.competitions.organizationId, selectAccessibleOrganizationIds(caller, "participants:read")),
              isNull(model.competitions.deletedAt),
            ),
          );
        return yield* Effect.promise(() =>
          db
            .select(columns)
            .from(participants)
            .where(
              and(
                inArray(participants.competitionId, competitions),
                isNull(participants.deletedAt),
                competitionId ? eq(participants.competitionId, competitionId) : undefined,
              ),
            )
            .orderBy(participants.id),
        );
      });

      // Every sign-in, and entering signed in, claims the guest entries made with the user's verified
      // email, in every competition, and cuts off their guest tokens (adr/0004). A claimed entry takes
      // the account's name, unless the account has none. Skips a competition the user already has an entry in.
      const claimGuestEntries = Effect.fn("ParticipantsService.claimGuestEntries")(function* (userId: string) {
        const { user } = model;
        const account = (column: typeof user.email | typeof user.name) =>
          sql`(select ${column} from ${user} where ${user.id} = ${userId} and ${user.emailVerified})`;
        yield* Effect.promise(() =>
          db
            .update(participants)
            .set({
              userId,
              name: sql`coalesce(nullif(${account(user.name)}, ''), ${participants.name})`,
              guestTokenHash: null,
              updatedAt: sql`now()`,
            })
            .where(
              and(
                isNull(participants.userId),
                sql`${participants.email} = lower(${account(user.email)})`,
                sql`not exists (select 1 from ${participants} as mine where mine.competition_id = ${participants.competitionId} and mine.user_id = ${userId})`,
              ),
            ),
        );
      });

      // Signed in, the entry comes from the account and entering again returns it. A guest gets a
      // token, returned only here (adr/0004).
      const enter = Effect.fn("ParticipantsService.enter")(function* (
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

        const result = yield* Effect.promise(() =>
          db.transaction(async (tx) => {
            // Shared, so entries don't wait on each other, but an unpublish (FOR UPDATE) waits for them.
            const [competition] = await tx
              .select({ closed: sql<boolean>`${model.competitions.closesAt} <= now()` })
              .from(model.competitions)
              .where(
                and(
                  eq(model.competitions.id, competitionId),
                  isNull(model.competitions.deletedAt),
                  isNotNull(model.competitions.publishedAt),
                ),
              )
              .for("share");
            if (!competition) return "not-found" as const;
            if (competition.closed) return "closed" as const;

            if (!user) {
              const [created] = await tx
                .insert(participants)
                .values({ competitionId, name: guest.name!, email: guest.email!.toLowerCase(), guestTokenHash: tokenHash })
                .onConflictDoNothing()
                .returning(entryColumns);
              return created ? { participant: created, guest_token: token } : ("taken" as const);
            }

            const mine = () =>
              tx
                .select(entryColumns)
                .from(participants)
                .where(and(eq(participants.competitionId, competitionId), eq(participants.userId, user.id)))
                .then(([row]) => row);
            const existing = await mine();
            if (existing) return { participant: existing, guest_token: null };

            const [created] = await tx
              .insert(participants)
              // Accounts made with an emailed code have no name.
              .values({ competitionId, userId: user.id, name: user.name || user.email, email: user.email.toLowerCase() })
              .onConflictDoNothing()
              .returning(entryColumns);
            if (created) return { participant: created, guest_token: null };
            // The same user entering twice at once: the other request created it.
            const raced = await mine();
            return raced ? { participant: raced, guest_token: null } : ("taken" as const);
          }),
        );
        if (result === "not-found") return yield* new CompetitionNotFound();
        if (result === "closed") return yield* new EntryClosed();
        if (result === "taken") return yield* new AlreadyEntered();
        return result;
      });

      // Every entry route reads through this (adr/0004): the entries the session's user or the guest token owns.
      const owned = Effect.fn("ParticipantsService.owned")(function* (caller: EntryCaller["Service"]) {
        const tokenHash = caller.guestToken ? yield* Effect.promise(() => hashToken(caller.guestToken!)) : null;
        const owners = [
          caller.user && eq(participants.userId, caller.user.id),
          tokenHash && eq(participants.guestTokenHash, tokenHash),
        ].filter((owner) => !!owner);
        // Neither a session nor a token owns nothing; an empty or() would match every row.
        return and(isNull(participants.deletedAt), owners.length ? or(...owners) : sql`false`);
      });

      const listOwn = Effect.fn("ParticipantsService.listOwn")(function* (
        caller: EntryCaller["Service"],
        competitionId?: string,
      ) {
        const scope = yield* owned(caller);
        return yield* Effect.promise(() =>
          db
            .select(entryColumns)
            .from(participants)
            .where(and(scope, competitionId ? eq(participants.competitionId, competitionId) : undefined))
            .orderBy(participants.id),
        );
      });

      const requireParticipantOwner = Effect.fn("ParticipantsService.requireParticipantOwner")(function* (
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

      return { list, claimGuestEntries, enter, listOwn, requireParticipantOwner };
    }),
  },
) {
  static readonly layer = Layer.effect(ParticipantsService, ParticipantsService.make);
}
