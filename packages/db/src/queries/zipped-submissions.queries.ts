import { Effect, Layer, ServiceMap } from "effect";
import { DrizzleClient } from "../drizzle-client";
import { participants } from "../schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
export class ZippedSubmissionsQueries extends ServiceMap.Service<ZippedSubmissionsQueries>()(
  "@blikka/db/zipped-submissions-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;
      const getZippedSubmissionsByDomain = Effect.fn(
        "ZippedSubmissionsQueries.getZippedSubmissionsByDomain",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
          }),
        );
        if (!marathon) {
          return [];
        }
        const result = yield* use((db) =>
          db.query.zippedSubmissions.findMany({
            where: (table, operators) =>
              operators.eq(table.marathonId, marathon.id),
            with: {
              participant: {
                with: {
                  competitionClass: true,
                },
              },
            },
          }),
        );
        return result;
      });
      const getZippedSubmissionsByReferenceRange = Effect.fn(
        "ZippedSubmissionsQueries.getZippedSubmissionsByReferenceRange",
      )(function* ({
        domain,
        competitionClassId,
        minReference,
        maxReference,
      }: {
        domain: string;
        competitionClassId: number;
        minReference: number;
        maxReference: number;
      }) {
        const marathon = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
          }),
        );
        if (!marathon) {
          return [];
        }
        const matchingParticipants = yield* use((db) =>
          db
            .select({ id: participants.id })
            .from(participants)
            .where(
              and(
                eq(participants.marathonId, marathon.id),
                eq(participants.competitionClassId, competitionClassId),
                gte(
                  sql`CAST(${participants.reference} AS INTEGER)`,
                  minReference,
                ),
                lte(
                  sql`CAST(${participants.reference} AS INTEGER)`,
                  maxReference,
                ),
              ),
            ),
        );
        if (matchingParticipants.length === 0) {
          return [];
        }
        const participantIds = matchingParticipants.map((p) => p.id);
        const result = yield* use((db) =>
          db.query.zippedSubmissions.findMany({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, marathon.id),
                operators.inArray(table.participantId, participantIds),
              ),
            with: {
              participant: {
                with: {
                  competitionClass: true,
                },
              },
            },
          }),
        );
        return result.sort(
          (a, b) =>
            Number(a.participant.reference) - Number(b.participant.reference),
        );
      });
      const getZipSubmissionStatsByDomain = Effect.fn(
        "ZippedSubmissionsQueries.getZipSubmissionStatsByDomain",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
          }),
        );
        if (!marathon) {
          return {
            totalParticipants: 0,
            withZippedSubmissions: 0,
            missingReferences: [],
          };
        }
        const allParticipants = yield* use((db) =>
          db.query.participants.findMany({
            where: (table, operators) =>
              operators.eq(table.marathonId, marathon.id),
            columns: {
              id: true,
              reference: true,
            },
          }),
        );
        if (allParticipants.length === 0) {
          return {
            totalParticipants: 0,
            withZippedSubmissions: 0,
            missingReferences: [],
          };
        }
        const participantIds = allParticipants.map((p) => p.id);
        const zippedSubmissionsData = yield* use((db) =>
          db.query.zippedSubmissions.findMany({
            where: (table, operators) =>
              operators.inArray(table.participantId, participantIds),
            columns: {
              participantId: true,
            },
          }),
        );
        const zippedParticipantIds = new Set(
          zippedSubmissionsData.map((zs) => zs.participantId),
        );
        const withZippedSubmissions = zippedParticipantIds.size;
        const missingReferences = allParticipants
          .filter((p) => !zippedParticipantIds.has(p.id))
          .map((p) => p.reference)
          .sort((a, b) => Number(a) - Number(b));
        return {
          totalParticipants: allParticipants.length,
          withZippedSubmissions,
          missingReferences,
        };
      });
      return {
        getZippedSubmissionsByDomain,
        getZippedSubmissionsByReferenceRange,
        getZipSubmissionStatsByDomain,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
