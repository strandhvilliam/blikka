import { and, eq, exists, inArray, isNull, not, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { ParticipantNotFound } from "../entry/schemas.ts";
import { PermissionsService } from "../permissions/service.ts";

const { participants } = model;

const columns = {
  id: participants.id,
  competition_id: participants.competitionId,
  name: participants.name,
  email: participants.email,
  signed_in: sql<boolean>`${participants.userId} is not null`,
  created_at: participants.createdAt,
  submissions: sql<number>`(
    select count(*)::int from ${model.submissions}
    inner join ${model.topics} on ${model.topics}.id = ${model.submissions}.topic_id
    where ${model.submissions}.participant_id = ${participants}.id and ${model.topics}.deleted_at is null
  )`,
};

export class ParticipantsService extends Context.Service<ParticipantsService>()(
  "blikka/participants/ParticipantsService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const { authorize, selectAccessibleOrganizationIds } = yield* PermissionsService;

      const readable = (caller: User) => {
        const organizationIds = selectAccessibleOrganizationIds(caller, "participants:read");

        const competitions = db
          .select({ id: model.competitions.id })
          .from(model.competitions)
          .where(
            and(inArray(model.competitions.organizationId, organizationIds), isNull(model.competitions.deletedAt)),
          );

        return and(inArray(participants.competitionId, competitions), isNull(participants.deletedAt));
      };

      const list = Effect.fn("ParticipantsService.list")(function* (caller: User, competitionId?: string) {
        const filters = [readable(caller)];

        if (competitionId) {
          filters.push(eq(participants.competitionId, competitionId));
        }

        return yield* Effect.promise(() =>
          db
            .select(columns)
            .from(participants)
            .where(and(...filters))
            .orderBy(participants.id),
        );
      });

      const get = Effect.fn("ParticipantsService.get")(function* (caller: User, id: string) {
        const [participant] = yield* Effect.promise(() =>
          db
            .select(columns)
            .from(participants)
            .where(and(readable(caller), eq(participants.id, id))),
        );

        if (!participant) {
          return yield* new ParticipantNotFound();
        }

        return participant;
      });

      const remove = Effect.fn("ParticipantsService.remove")(function* (caller: User, id: string) {
        const [entry] = yield* Effect.promise(() =>
          db
            .select({ organizationId: model.competitions.organizationId })
            .from(participants)
            .innerJoin(model.competitions, eq(model.competitions.id, participants.competitionId))
            .where(and(readable(caller), eq(participants.id, id))),
        );

        if (!entry) {
          return yield* new ParticipantNotFound();
        }

        yield* authorize(caller, "participants:write", entry.organizationId).pipe(
          Effect.catchTag("OrganizationNotFound", () => Effect.fail(new ParticipantNotFound())),
        );

        yield* Effect.promise(() =>
          db
            .update(participants)
            .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
            .where(and(eq(participants.id, id), isNull(participants.deletedAt))),
        );
      });

      const claimGuestEntries = Effect.fn("ParticipantsService.claimGuestEntries")(function* (userId: string) {
        const { user } = model;

        const [account] = yield* Effect.promise(() =>
          db
            .select({ email: user.email, name: user.name })
            .from(user)
            .where(and(eq(user.id, userId), eq(user.emailVerified, true))),
        );

        if (!account) {
          return;
        }

        let name: string | undefined;

        if (account.name !== "") {
          name = account.name;
        }

        const mine = alias(participants, "mine");

        const alreadyEntered = exists(
          db
            .select({ id: mine.id })
            .from(mine)
            .where(
              and(eq(mine.competitionId, participants.competitionId), eq(mine.userId, userId), isNull(mine.deletedAt)),
            ),
        );

        yield* Effect.promise(() =>
          db
            .update(participants)
            .set({
              userId,
              name,
              guestTokenHash: null,
              updatedAt: sql`now()`,
            })
            .where(
              and(
                isNull(participants.userId),
                isNull(participants.deletedAt),
                eq(participants.email, account.email.toLowerCase()),
                not(alreadyEntered),
              ),
            ),
        );
      });

      return { list, get, remove, claimGuestEntries };
    }),
  },
) {
  static readonly layer = Layer.effect(ParticipantsService, ParticipantsService.make);
}
