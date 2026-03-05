import { Effect, Layer, Option, ServiceMap } from "effect";
import { DrizzleClient } from "../drizzle-client";
import { eq, inArray } from "drizzle-orm";
import {
  marathons,
  participants,
  validationResults,
  submissions,
  zippedSubmissions,
  juryInvitations,
} from "../schema";
import { topics } from "../schema";
import { competitionClasses } from "../schema";
import { deviceGroups } from "../schema";
import { ruleConfigs } from "../schema";
import { sponsors } from "../schema";
import { participantVerifications } from "../schema";
import type { NewMarathon } from "../types";
import { DbError } from "../utils";
export class MarathonsQueries extends ServiceMap.Service<MarathonsQueries>()(
  "@blikka/db/marathons-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;
      const getMarathons = Effect.fn("MarathonsQueries.getMarathons")(
        function* () {
          return yield* use((db) =>
            db.query.marathons.findMany({
              with: {
                competitionClasses: true,
                topics: true,
              },
            }),
          );
        },
      );
      const getMarathonById = Effect.fn("MarathonsQueries.getMarathonById")(
        function* ({ id }: { id: number }) {
          const result = yield* use((db) =>
            db.query.marathons.findFirst({
              where: (table, operators) => operators.eq(table.id, id),
            }),
          );
          return Option.fromNullishOr(result);
        },
      );
      const getMarathonByDomain = Effect.fn(
        "MarathonsQueries.getMarathonByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getMarathonByDomainWithOptions = Effect.fn(
        "MarathonsQueries.getMarathonByDomainWithOptions",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              competitionClasses: true,
              topics: true,
              deviceGroups: true,
              sponsors: true,
              ruleConfigs: true,
            },
          }),
        );
        return Option.fromNullishOr(result);
      });
      const createMarathon = Effect.fn("MarathonsQueries.createMarathon")(
        function* ({ data }: { data: NewMarathon }) {
          const [result] = yield* use((db) =>
            db.insert(marathons).values(data).returning(),
          );
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to create marathon",
              }),
            );
          }
          return result;
        },
      );
      const updateMarathon = Effect.fn("MarathonsQueries.updateMarathon")(
        function* ({ id, data }: { id: number; data: Partial<NewMarathon> }) {
          const [result] = yield* use((db) =>
            db
              .update(marathons)
              .set(data)
              .where(eq(marathons.id, id))
              .returning(),
          );
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to update marathon",
              }),
            );
          }
          return result;
        },
      );
      const updateMarathonByDomain = Effect.fn(
        "MarathonsQueries.updateMarathonByDomain",
      )(function* ({
        domain,
        data,
      }: {
        domain: string;
        data: Partial<NewMarathon>;
      }) {
        if (!data.updatedAt) {
          data.updatedAt = new Date().toISOString();
        }
        const [result] = yield* use((db) =>
          db
            .update(marathons)
            .set(data)
            .where(eq(marathons.domain, domain))
            .returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update marathon by domain",
            }),
          );
        }
        return result;
      });
      const deleteMarathon = Effect.fn("MarathonsQueries.deleteMarathon")(
        function* ({ id }: { id: number }) {
          const [result] = yield* use((db) =>
            db.delete(marathons).where(eq(marathons.id, id)).returning(),
          );
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to delete marathon",
              }),
            );
          }
          return result;
        },
      );
      const resetMarathon = Effect.fn("MarathonsQueries.resetMarathon")(
        function* ({ id }: { id: number }) {
          const marathon = yield* use((db) =>
            db.query.marathons.findFirst({
              where: (table, operators) => operators.eq(table.id, id),
            }),
          );
          if (!marathon) {
            return yield* Effect.fail(
              new DbError({
                message: "Marathon not found",
              }),
            );
          }
          const marathonParticipants = yield* use((db) =>
            db
              .select({ id: participants.id })
              .from(participants)
              .where(eq(participants.marathonId, id)),
          );
          const participantIds = marathonParticipants.map((p) => p.id);
          if (participantIds.length > 0) {
            yield* use((db) =>
              db
                .delete(validationResults)
                .where(
                  inArray(validationResults.participantId, participantIds),
                ),
            );
          }
          if (participantIds.length > 0) {
            yield* use((db) =>
              db
                .delete(participantVerifications)
                .where(
                  inArray(
                    participantVerifications.participantId,
                    participantIds,
                  ),
                ),
            );
          }
          yield* use((db) =>
            db.delete(submissions).where(eq(submissions.marathonId, id)),
          );
          yield* use((db) =>
            db
              .delete(zippedSubmissions)
              .where(eq(zippedSubmissions.marathonId, id)),
          );
          yield* use((db) =>
            db.delete(participants).where(eq(participants.marathonId, id)),
          );
          yield* use((db) =>
            db
              .delete(juryInvitations)
              .where(eq(juryInvitations.marathonId, id)),
          );
          yield* use((db) =>
            db.delete(topics).where(eq(topics.marathonId, id)),
          );
          yield* use((db) =>
            db
              .delete(competitionClasses)
              .where(eq(competitionClasses.marathonId, id)),
          );
          yield* use((db) =>
            db.delete(deviceGroups).where(eq(deviceGroups.marathonId, id)),
          );
          yield* use((db) =>
            db.delete(ruleConfigs).where(eq(ruleConfigs.marathonId, id)),
          );
          yield* use((db) =>
            db.delete(sponsors).where(eq(sponsors.marathonId, id)),
          );
          yield* use((db) =>
            db
              .update(marathons)
              .set({
                setupCompleted: false,
                updatedAt: new Date().toISOString(),
                startDate: null,
                endDate: null,
                name: "",
                description: null,
                logoUrl: null,
                languages: "en",
                termsAndConditionsKey: null,
              })
              .where(eq(marathons.id, id)),
          );
          return { id };
        },
      );
      return {
        getMarathons,
        getMarathonById,
        getMarathonByDomain,
        getMarathonByDomainWithOptions,
        createMarathon,
        updateMarathon,
        updateMarathonByDomain,
        deleteMarathon,
        resetMarathon,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
