import { and, eq, inArray, isNull, not, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";

const { participants } = model;

// The organizer's view of an entry (Participant). Participants read theirs through entry/service.ts.
const columns = {
  id: participants.id,
  competition_id: participants.competitionId,
  name: participants.name,
  email: participants.email,
  signed_in: sql<boolean>`${participants.userId} is not null`,
  created_at: participants.createdAt,
};

export class ParticipantsService extends Context.Service<ParticipantsService>()(
  "blikka/participants/ParticipantsService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const { selectAccessibleOrganizationIds } = yield* PermissionsService;

      // The organizer's view (adr/0006): entries in competitions of organizations the caller can
      // read participants in.
      const list = Effect.fn("ParticipantsService.list")(function* (
        caller: User,
        competitionId?: string,
      ) {
        const organizationIds = selectAccessibleOrganizationIds(caller, "participants:read");
        const competitions = db
          .select({ id: model.competitions.id })
          .from(model.competitions)
          .where(
            and(
              inArray(model.competitions.organizationId, organizationIds),
              isNull(model.competitions.deletedAt),
            ),
          );
        const filters = [
          inArray(participants.competitionId, competitions),
          isNull(participants.deletedAt),
        ];
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

      // Every sign-in, and entering signed in, claims the guest entries made with the user's verified
      // email, in every competition, and cuts off their guest tokens (adr/0004). A claimed entry takes
      // the account's name, unless the account has none. Skips a competition the user already has an entry in.
      const claimGuestEntries = Effect.fn("ParticipantsService.claimGuestEntries")(function* (
        userId: string,
      ) {
        const { user } = model;
        // A column of the user's account, null until its email is verified.
        const verified = (column: typeof user.email | typeof user.name) =>
          sql`(select ${column} from ${user} where ${user.id} = ${userId} and ${user.emailVerified})`;
        const accountName = verified(user.name);
        const accountEmail = verified(user.email);
        const alreadyEntered = sql`exists (
          select 1 from ${participants} as mine
          where mine.competition_id = ${participants.competitionId} and mine.user_id = ${userId}
        )`;

        yield* Effect.promise(() =>
          db
            .update(participants)
            .set({
              userId,
              name: sql`coalesce(nullif(${accountName}, ''), ${participants.name})`,
              guestTokenHash: null,
              updatedAt: sql`now()`,
            })
            .where(
              and(
                isNull(participants.userId),
                sql`${participants.email} = lower(${accountEmail})`,
                not(alreadyEntered),
              ),
            ),
        );
      });

      return { list, claimGuestEntries };
    }),
  },
) {
  static readonly layer = Layer.effect(ParticipantsService, ParticipantsService.make);
}
