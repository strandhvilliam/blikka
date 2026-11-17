import { and, eq, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type EntryCaller, GUEST_TOKEN_PREFIX } from "../auth/EntrySession.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import type { User } from "../contract.ts";
import { Db, transaction, type Tx } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { ParticipantsService } from "../participants/service.ts";
import { availableTopics } from "../topics/availableTopics.ts";
import { TopicNotFound } from "../topics/schemas.ts";
import {
  AlreadyEntered,
  EntryClosed,
  type EntryParticipant,
  GuestDetailsRequired,
  ParticipantNotFound,
  TopicNotOpen,
} from "./schemas.ts";

const { participants, submissions } = model;

const entryColumns = {
  id: participants.id,
  competition_id: participants.competitionId,
  name: participants.name,
  email: participants.email,
  created_at: participants.createdAt,
};

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

  return hex(digest);
};

type GuestDetails = { name?: string | undefined; email?: string | undefined };

const lockOpenCompetition = (tx: Tx, competitionId: string) =>
  Effect.gen(function* () {
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

    if (!competition) {
      return yield* new CompetitionNotFound();
    }

    if (competition.closed) {
      return yield* new EntryClosed();
    }
  });

export class EntryService extends Context.Service<EntryService>()("blikka/entry/EntryService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { claimGuestEntries } = yield* ParticipantsService;

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

      if (!competition) {
        return yield* new CompetitionNotFound();
      }

      return competition;
    });

    const enterAsGuest = Effect.fn("EntryService.enterAsGuest")(function* (competitionId: string, guest: GuestDetails) {
      const { name, email } = guest;

      if (!name || !email) {
        return yield* new GuestDetailsRequired();
      }

      const token = GUEST_TOKEN_PREFIX + hex(crypto.getRandomValues(new Uint8Array(32)));
      const guestTokenHash = yield* Effect.promise(() => hashToken(token));

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          yield* lockOpenCompetition(tx, competitionId);

          const [created] = yield* Effect.promise(() =>
            tx
              .insert(participants)
              .values({ competitionId, name, email: email.toLowerCase(), guestTokenHash })
              .onConflictDoNothing()
              .returning(entryColumns),
          );

          if (!created) {
            return yield* new AlreadyEntered();
          }

          return { participant: created, guest_token: token };
        }),
      );
    });

    const enterSignedIn = Effect.fn("EntryService.enterSignedIn")(function* (user: User, competitionId: string) {
      yield* claimGuestEntries(user.id);

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          yield* lockOpenCompetition(tx, competitionId);

          const findOwn = Effect.gen(function* () {
            const [own] = yield* Effect.promise(() =>
              tx
                .select(entryColumns)
                .from(participants)
                .where(
                  and(
                    eq(participants.competitionId, competitionId),
                    eq(participants.userId, user.id),
                    isNull(participants.deletedAt),
                  ),
                ),
            );

            return own;
          });

          const existing = yield* findOwn;

          if (existing) {
            return { participant: existing, guest_token: null };
          }

          const [created] = yield* Effect.promise(() =>
            tx
              .insert(participants)
              .values({
                competitionId,
                userId: user.id,
                name: user.name || user.email,
                email: user.email.toLowerCase(),
              })
              .onConflictDoNothing()
              .returning(entryColumns),
          );

          if (created) {
            return { participant: created, guest_token: null };
          }

          const raced = yield* findOwn;

          if (!raced) {
            return yield* new AlreadyEntered();
          }

          return { participant: raced, guest_token: null };
        }),
      );
    });

    const enter = Effect.fn("EntryService.enter")(function* (
      user: User | null,
      competitionId: string,
      guest: GuestDetails,
    ) {
      if (user) {
        return yield* enterSignedIn(user, competitionId);
      }

      return yield* enterAsGuest(competitionId, guest);
    });

    const owned = Effect.fn("EntryService.owned")(function* (caller: EntryCaller["Service"]) {
      const { user, guestToken } = caller;
      const owners: Array<SQL> = [];

      if (user) {
        owners.push(eq(participants.userId, user.id));
      }

      if (guestToken) {
        const tokenHash = yield* Effect.promise(() => hashToken(guestToken));
        owners.push(eq(participants.guestTokenHash, tokenHash));
      }

      if (owners.length === 0) {
        return sql`false`;
      }

      return and(isNull(participants.deletedAt), or(...owners));
    });

    const listOwn = Effect.fn("EntryService.listOwn")(function* (
      caller: EntryCaller["Service"],
      competitionId?: string,
    ) {
      const filters = [yield* owned(caller)];

      if (competitionId) {
        filters.push(eq(participants.competitionId, competitionId));
      }

      return yield* Effect.promise(() =>
        db
          .select(entryColumns)
          .from(participants)
          .where(and(...filters))
          .orderBy(participants.id),
      );
    });

    const requireParticipantOwner = Effect.fn("EntryService.requireParticipantOwner")(function* (
      caller: EntryCaller["Service"],
      id: string,
    ) {
      const scope = yield* owned(caller);

      const [row] = yield* Effect.promise(() =>
        db
          .select(entryColumns)
          .from(participants)
          .where(and(scope, eq(participants.id, id))),
      );

      if (!row) {
        return yield* new ParticipantNotFound();
      }

      return row;
    });

    const progress = Effect.fn("EntryService.progress")(function* (
      participant: EntryParticipant,
      tx: Tx | Db["Service"] = db,
    ) {
      const [competition] = yield* Effect.promise(() =>
        tx
          .select({
            opensAt: model.competitions.opensAt,
            closesAt: model.competitions.closesAt,
            topicsInSequence: model.competitions.topicsInSequence,
            minutesPerTopic: model.competitions.minutesPerTopic,
          })
          .from(model.competitions)
          .where(and(eq(model.competitions.id, participant.competition_id), isNull(model.competitions.deletedAt))),
      );

      if (!competition) {
        return yield* new ParticipantNotFound();
      }

      const topics = yield* Effect.promise(() =>
        tx
          .select({ id: model.topics.id, position: model.topics.position, name: model.topics.name })
          .from(model.topics)
          .where(and(eq(model.topics.competitionId, participant.competition_id), isNull(model.topics.deletedAt)))
          .orderBy(model.topics.position),
      );

      const submitted = yield* Effect.promise(() =>
        tx
          .select({ topicId: submissions.topicId, createdAt: submissions.createdAt })
          .from(submissions)
          .where(eq(submissions.participantId, participant.id)),
      );

      return { competition: { ...competition, topics }, submissions: submitted };
    });

    const listTopics = Effect.fn("EntryService.listTopics")(function* (
      caller: EntryCaller["Service"],
      participantId: string,
    ) {
      const participant = yield* requireParticipantOwner(caller, participantId);
      const { competition, submissions } = yield* progress(participant);

      const topics = availableTopics(competition, { createdAt: participant.created_at }, submissions, new Date());

      return topics.map((topic) => ({
        id: topic.id,
        position: topic.position,
        name: topic.status === "locked" ? null : topic.name,
        status: topic.status,
        closes_at: topic.closesAt,
      }));
    });

    const submit = Effect.fn("EntryService.submit")(function* (
      caller: EntryCaller["Service"],
      participantId: string,
      topicId: string,
    ) {
      const participant = yield* requireParticipantOwner(caller, participantId);

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            tx
              .select({ id: model.competitions.id })
              .from(model.competitions)
              .where(eq(model.competitions.id, participant.competition_id))
              .for("share"),
          );

          const { competition, submissions: submitted } = yield* progress(participant, tx);

          const others = submitted.filter((submission) => submission.topicId !== topicId);

          const topic = availableTopics(competition, { createdAt: participant.created_at }, others, new Date()).find(
            (topic) => topic.id === topicId,
          );

          if (!topic) {
            return yield* new TopicNotFound();
          }

          if (topic.status !== "open") {
            return yield* new TopicNotOpen();
          }

          const [submission] = yield* Effect.promise(() =>
            tx
              .insert(submissions)
              .values({ participantId, topicId })
              .onConflictDoUpdate({
                target: [submissions.participantId, submissions.topicId],
                set: { updatedAt: sql`now()` },
              })
              .returning({
                id: submissions.id,
                participant_id: submissions.participantId,
                topic_id: submissions.topicId,
                created_at: submissions.createdAt,
                updated_at: submissions.updatedAt,
              }),
          );

          return submission!;
        }),
      );
    });

    return { getPublished, enter, listOwn, requireParticipantOwner, listTopics, submit };
  }),
}) {
  static readonly layer = Layer.effect(EntryService, EntryService.make).pipe(Layer.provide(ParticipantsService.layer));
}
