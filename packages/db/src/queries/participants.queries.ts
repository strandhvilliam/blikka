import { Effect, Layer, Option, ServiceMap } from "effect";
import { DrizzleClient } from "../drizzle-client";
import {
  participants,
  submissions,
  validationResults,
  votingRound,
  votingRoundVote,
  votingSession,
} from "../schema";
import {
  eq,
  and,
  or,
  inArray,
  gt,
  lt,
  ilike,
  notInArray,
  isNotNull,
  count,
  sql,
} from "drizzle-orm";
import type { NewParticipant } from "../types";
import { DbError } from "../utils";
import { VALIDATION_OUTCOME } from "@blikka/validation";
export class ParticipantsQueries extends ServiceMap.Service<ParticipantsQueries>()(
  "@blikka/db/participants-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;
      const getParticipantById = Effect.fn(
        "ParticipantsQueries.getParticipantByIdQuery",
      )(function* ({ id }: { id: number }) {
        const result = yield* use((db) =>
          db.query.participants.findFirst({
            where: (table, operators) => operators.eq(table.id, id),
            with: {
              submissions: true,
              competitionClass: true,
              deviceGroup: true,
              validationResults: true,
              zippedSubmissions: true,
            },
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getParticipantByReference = Effect.fn(
        "ParticipantsQueries.getParticipantByReferenceQuery",
      )(function* ({
        reference,
        domain,
      }: {
        reference: string;
        domain: string;
      }) {
        const result = yield* use((db) =>
          db.query.participants.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.reference, reference),
                operators.eq(table.domain, domain),
              ),
            with: {
              submissions: {
                with: {
                  topic: true,
                },
              },
              competitionClass: true,
              deviceGroup: true,
              validationResults: true,
              zippedSubmissions: true,
              contactSheets: true,
            },
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getByPhoneHashForByCamera = Effect.fn(
        "ParticipantsQueries.getByPhoneHashForByCameraQuery",
      )(function* ({
        marathonId,
        phoneHash,
      }: {
        marathonId: number;
        phoneHash: string;
      }) {
        const result = yield* use((db) =>
          db.query.participants.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, marathonId),
                operators.eq(table.participantMode, "by-camera"),
                operators.eq(table.phoneHash, phoneHash),
              ),
            orderBy: (table, operators) => [
              operators.desc(table.updatedAt),
              operators.desc(table.id),
            ],
            with: {
              submissions: {
                with: {
                  topic: true,
                },
              },
              competitionClass: true,
              deviceGroup: true,
              validationResults: true,
              zippedSubmissions: true,
              contactSheets: true,
            },
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsQueries.getInfiniteParticipantsByDomainQuery",
      )(function* ({
        domain,
        cursor,
        limit = 50,
        search,
        sortOrder = "desc",
        competitionClassId,
        deviceGroupId,
        topicId,
        statusFilter,
        excludeStatuses,
        includeStatuses,
        hasValidationErrors,
        votedFilter,
      }: {
        domain: string;
        cursor?: string;
        limit?: number;
        search?: string;
        sortOrder?: "asc" | "desc";
        competitionClassId?: number | number[] | readonly number[];
        deviceGroupId?: number | number[] | readonly number[];
        topicId?: number;
        statusFilter?: "completed" | "verified";
        excludeStatuses?: string[];
        includeStatuses?: string[];
        hasValidationErrors?: boolean;
        votedFilter?: "voted" | "not-voted";
      }) {
        const cursorId = cursor ? parseInt(cursor, 10) : undefined;
        const isValidCursor = cursorId !== undefined && !isNaN(cursorId);
        const baseConditions = [eq(participants.domain, domain)];
        if (isValidCursor) {
          if (sortOrder === "desc") {
            baseConditions.push(lt(participants.id, cursorId!));
          } else {
            baseConditions.push(gt(participants.id, cursorId!));
          }
        }
        if (competitionClassId !== undefined) {
          if (Array.isArray(competitionClassId)) {
            baseConditions.push(
              inArray(participants.competitionClassId, [...competitionClassId]),
            );
          } else {
            baseConditions.push(
              eq(participants.competitionClassId, competitionClassId as number),
            );
          }
        }
        if (deviceGroupId !== undefined) {
          if (Array.isArray(deviceGroupId)) {
            baseConditions.push(
              inArray(participants.deviceGroupId, [...deviceGroupId]),
            );
          } else {
            baseConditions.push(
              eq(participants.deviceGroupId, deviceGroupId as number),
            );
          }
        }
        if (search && search.trim().length > 0) {
          const searchPattern = `%${search.trim()}%`;
          baseConditions.push(
            or(
              ilike(participants.reference, searchPattern),
              ilike(participants.firstname, searchPattern),
              ilike(participants.lastname, searchPattern),
              ilike(participants.email, searchPattern),
            )!,
          );
        }
        if (statusFilter) {
          baseConditions.push(eq(participants.status, statusFilter));
        }
        if (excludeStatuses && excludeStatuses.length > 0) {
          baseConditions.push(notInArray(participants.status, excludeStatuses));
        }
        if (includeStatuses && includeStatuses.length > 0) {
          baseConditions.push(
            inArray(participants.status, [...includeStatuses]),
          );
        }
        if (hasValidationErrors) {
          const participantsWithErrors = yield* use((db) =>
            db
              .selectDistinct({
                participantId: validationResults.participantId,
              })
              .from(validationResults)
              .innerJoin(
                participants,
                eq(participants.id, validationResults.participantId),
              )
              .where(
                and(
                  eq(participants.domain, domain),
                  eq(validationResults.outcome, VALIDATION_OUTCOME.FAILED),
                  or(
                    eq(validationResults.severity, "error"),
                    eq(validationResults.severity, "warning"),
                  ),
                ),
              ),
          );
          const participantIdsWithErrors = participantsWithErrors.map(
            (p) => p.participantId,
          );
          if (participantIdsWithErrors.length === 0) {
            return {
              participants: [],
              nextCursor: null,
            };
          }
          baseConditions.push(
            inArray(participants.id, participantIdsWithErrors),
          );
        }
        if (topicId !== undefined) {
          const participantsWithTopicSubmissions = yield* use((db) =>
            db
              .selectDistinct({ participantId: submissions.participantId })
              .from(submissions)
              .innerJoin(
                participants,
                eq(participants.id, submissions.participantId),
              )
              .where(
                and(
                  eq(participants.domain, domain),
                  eq(submissions.topicId, topicId),
                ),
              ),
          );
          const participantIdsWithTopicSubmissions =
            participantsWithTopicSubmissions.map((p) => p.participantId);
          if (participantIdsWithTopicSubmissions.length === 0) {
            return {
              participants: [],
              nextCursor: null,
            };
          }
          baseConditions.push(
            inArray(participants.id, participantIdsWithTopicSubmissions),
          );
        }
        if (
          (votedFilter === "voted" || votedFilter === "not-voted") &&
          topicId !== undefined
        ) {
          const participantsWhoVoted = yield* use((db) =>
            db
              .selectDistinct({
                participantId: votingSession.connectedParticipantId,
              })
              .from(votingRoundVote)
              .innerJoin(
                votingSession,
                eq(votingSession.id, votingRoundVote.sessionId),
              )
              .innerJoin(
                participants,
                eq(participants.id, votingSession.connectedParticipantId),
              )
              .innerJoin(
                votingRound,
                eq(votingRound.id, votingRoundVote.roundId),
              )
              .where(
                and(
                  eq(participants.domain, domain),
                  eq(votingSession.topicId, topicId),
                  eq(
                    votingRoundVote.roundId,
                    sql`(
                      select vr.id
                      from voting_round vr
                      where vr.topic_id = ${topicId}
                      order by vr.round_number desc, vr.id desc
                      limit 1
                    )`,
                  ),
                ),
              ),
          );
          const participantIdsWhoVoted = participantsWhoVoted
            .map((p) => p.participantId)
            .filter((id): id is number => id !== null);
          if (votedFilter === "voted") {
            if (participantIdsWhoVoted.length === 0) {
              return {
                participants: [],
                nextCursor: null,
              };
            }
            baseConditions.push(
              inArray(participants.id, participantIdsWhoVoted),
            );
          } else {
            if (participantIdsWhoVoted.length > 0) {
              baseConditions.push(
                notInArray(participants.id, participantIdsWhoVoted),
              );
            }
          }
        }
        const whereCondition =
          baseConditions.length === 1
            ? baseConditions[0]
            : and(...baseConditions);
        const participant = yield* use((db) =>
          db.query.participants.findMany({
            where: whereCondition,
            columns: {
              phoneHash: false,
              phoneEncrypted: false,
            },
            with: {
              competitionClass: true,
              deviceGroup: true,
              ...(topicId !== undefined
                ? {
                    submissions: {
                      columns: {
                        id: true,
                        topicId: true,
                        createdAt: true,
                      },
                      where: (table, operators) =>
                        operators.eq(table.topicId, topicId),
                    },
                  }
                : {}),
              validationResults: true,
              votingSessions: {
                columns: {
                  token: true,
                  topicId: true,
                  createdAt: true,
                },
                with: {
                  roundVotes: {
                    columns: {
                      votedAt: true,
                    },
                    with: {
                      round: {
                        columns: {
                          topicId: true,
                          roundNumber: true,
                        },
                      },
                    },
                  },
                },
              },
              zippedSubmissions: {
                columns: {
                  key: true,
                },
              },
              contactSheets: {
                columns: {
                  key: true,
                },
              },
            },
            limit: limit + 1,
            orderBy: (table, operators) =>
              sortOrder === "desc"
                ? operators.desc(table.id)
                : operators.asc(table.id),
          }),
        );
        function countValidationResults(
          validations: {
            outcome: string;
            severity: string;
          }[],
          outcome: string,
        ) {
          return validations
            .filter((vr) => vr.outcome === outcome)
            .reduce(
              (acc, vr) => {
                if (vr.severity === "error") acc.errors++;
                else if (vr.severity === "warning") acc.warnings++;
                return acc;
              },
              { errors: 0, warnings: 0 },
            );
        }
        let nextCursor: string | null = null;
        let participantsToReturn = participant;
        if (participant.length > limit) {
          participantsToReturn = participant.slice(0, limit);
          const lastParticipant =
            participantsToReturn[participantsToReturn.length - 1];
          nextCursor = lastParticipant ? lastParticipant.id.toString() : null;
        }
        const mappedResult = participantsToReturn.map(
          ({
            validationResults,
            zippedSubmissions,
            contactSheets,
            votingSessions,
            submissions: participantSubmissions = [],
            ...rest
          }) => {
            const activeTopicSubmissionId =
              topicId === undefined
                ? null
                : (participantSubmissions.sort(
                    (left, right) =>
                      new Date(right.createdAt).getTime() -
                      new Date(left.createdAt).getTime(),
                  )[0]?.id ?? null);
            return {
              ...rest,
              activeTopicSubmissionId,
              votingSession:
                votingSessions
                  .filter((session) =>
                    topicId !== undefined ? session.topicId === topicId : true,
                  )
                  .sort(
                    (left, right) =>
                      new Date(right.createdAt).getTime() -
                      new Date(left.createdAt).getTime(),
                  )
                  .map((session) => {
                    const latestRoundVote =
                      session.roundVotes
                        .filter((roundVote) =>
                          topicId !== undefined
                            ? roundVote.round?.topicId === topicId
                            : true,
                        )
                        .sort((left, right) => {
                          const leftRoundNumber = left.round?.roundNumber ?? 0;
                          const rightRoundNumber =
                            right.round?.roundNumber ?? 0;
                          return rightRoundNumber - leftRoundNumber;
                        })[0] ?? null;

                    return {
                      ...session,
                      votedAt: latestRoundVote?.votedAt ?? null,
                    };
                  })[0] ?? null,
              zipKeys: zippedSubmissions.map((zs) => zs.key),
              contactSheetKeys: contactSheets.map((cs) => cs.key),
              failedValidationResults: countValidationResults(
                validationResults,
                VALIDATION_OUTCOME.FAILED,
              ),
              passedValidationResults: countValidationResults(
                validationResults,
                VALIDATION_OUTCOME.PASSED,
              ),
              skippedValidationResults: countValidationResults(
                validationResults,
                VALIDATION_OUTCOME.SKIPPED,
              ),
            };
          },
        );
        return {
          participants: mappedResult,
          nextCursor,
        };
      });
      const getDashboardOverview = Effect.fn(
        "ParticipantsQueries.getDashboardOverview",
      )(function* ({ domain }: { domain: string }) {
        const [
          statusRows,
          participantsWithValidationIssues,
          recentParticipants,
        ] = yield* Effect.all([
          use((db) =>
            db
              .select({
                status: participants.status,
                count: count(),
              })
              .from(participants)
              .where(eq(participants.domain, domain))
              .groupBy(participants.status),
          ),
          use((db) =>
            db
              .selectDistinct({
                participantId: validationResults.participantId,
              })
              .from(validationResults)
              .innerJoin(
                participants,
                eq(participants.id, validationResults.participantId),
              )
              .where(
                and(
                  eq(participants.domain, domain),
                  eq(validationResults.outcome, VALIDATION_OUTCOME.FAILED),
                  or(
                    eq(validationResults.severity, "error"),
                    eq(validationResults.severity, "warning"),
                  ),
                ),
              ),
          ),
          use((db) =>
            db.query.participants.findMany({
              where: (table, operators) => operators.eq(table.domain, domain),
              columns: {
                id: true,
                reference: true,
                firstname: true,
                lastname: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
              with: {
                validationResults: {
                  columns: {
                    outcome: true,
                    severity: true,
                  },
                },
              },
              orderBy: (table, operators) => [
                operators.desc(table.updatedAt),
                operators.desc(table.createdAt),
                operators.desc(table.id),
              ],
              limit: 6,
            }),
          ),
        ]);

        const statusCounts = {
          prepared: 0,
          initialized: 0,
          completed: 0,
          verified: 0,
        };

        for (const row of statusRows) {
          if (row.status === "prepared") statusCounts.prepared = row.count;
          if (row.status === "initialized")
            statusCounts.initialized = row.count;
          if (row.status === "completed") statusCounts.completed = row.count;
          if (row.status === "verified") statusCounts.verified = row.count;
        }

        return {
          totalParticipants: statusRows.reduce(
            (total, row) => total + row.count,
            0,
          ),
          statusCounts,
          uploadedCount: statusCounts.completed + statusCounts.verified,
          validationIssueCount: participantsWithValidationIssues.length,
          recentParticipants: recentParticipants.map((participant) => ({
            id: participant.id,
            reference: participant.reference,
            firstname: participant.firstname,
            lastname: participant.lastname,
            status: participant.status,
            updatedAt: participant.updatedAt ?? participant.createdAt,
            validationIssueCount: participant.validationResults.filter(
              (validation) =>
                validation.outcome === VALIDATION_OUTCOME.FAILED &&
                (validation.severity === "error" ||
                  validation.severity === "warning"),
            ).length,
          })),
        };
      });
      const createParticipant = Effect.fn(
        "ParticipantsQueries.createParticipantMutation",
      )(function* ({ data }: { data: NewParticipant }) {
        if (!data.domain) {
          return yield* Effect.fail(
            new DbError({
              message: "Domain is required",
            }),
          );
        }
        const [result] = yield* use((db) =>
          db.insert(participants).values(data).returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create participant",
            }),
          );
        }
        return result;
      });
      const updateParticipantById = Effect.fn(
        "ParticipantsQueries.updateParticipantMutation",
      )(function* ({
        id,
        data,
      }: {
        id: number;
        data: Partial<NewParticipant>;
      }) {
        const [result] = yield* use((db) =>
          db
            .update(participants)
            .set(data)
            .where(eq(participants.id, id))
            .returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update participant",
            }),
          );
        }
        return result;
      });
      const updateParticipantByReference = Effect.fn(
        "ParticipantsQueries.updateParticipantByReference",
      )(function* ({
        reference,
        domain,
        data,
      }: {
        reference: string;
        domain: string;
        data: Partial<NewParticipant>;
      }) {
        const [result] = yield* use((db) =>
          db
            .update(participants)
            .set(data)
            .where(
              and(
                eq(participants.reference, reference),
                eq(participants.domain, domain),
              ),
            )
            .returning({ id: participants.id }),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update participant",
            }),
          );
        }
        return result;
      });
      const deleteParticipant = Effect.fn(
        "ParticipantsQueries.deleteParticipantMutation",
      )(function* ({ id }: { id: number }) {
        const [result] = yield* use((db) =>
          db.delete(participants).where(eq(participants.id, id)).returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete participant",
            }),
          );
        }
        return result;
      });
      const batchDeleteParticipants = Effect.fn(
        "ParticipantsQueries.batchDeleteParticipants",
      )(function* ({ ids, domain }: { ids: number[]; domain: string }) {
        if (ids.length === 0) {
          return { deletedCount: 0, failedIds: [] };
        }
        const results = yield* use((db) =>
          db
            .delete(participants)
            .where(
              and(
                eq(participants.domain, domain),
                inArray(participants.id, ids),
              ),
            )
            .returning({ id: participants.id }),
        );
        const deletedIds = results.map((r) => r.id);
        const failedIds = ids.filter((id) => !deletedIds.includes(id));
        return {
          deletedCount: deletedIds.length,
          failedIds,
        };
      });
      const batchVerifyParticipants = Effect.fn(
        "ParticipantsQueries.batchVerifyParticipants",
      )(function* ({ ids, domain }: { ids: number[]; domain: string }) {
        if (ids.length === 0) {
          return { updatedCount: 0, failedIds: [] };
        }
        const results = yield* use((db) =>
          db
            .update(participants)
            .set({ status: "verified" })
            .where(
              and(
                eq(participants.domain, domain),
                inArray(participants.id, ids),
                eq(participants.status, "completed"),
              ),
            )
            .returning({ id: participants.id }),
        );
        const updatedIds = results.map((r) => r.id);
        const failedIds = ids.filter((id) => !updatedIds.includes(id));
        return {
          updatedCount: updatedIds.length,
          failedIds,
        };
      });
      return {
        getParticipantById,
        getParticipantByReference,
        getByPhoneHashForByCamera,
        getInfiniteParticipantsByDomain,
        getDashboardOverview,
        createParticipant,
        updateParticipantById,
        updateParticipantByReference,
        deleteParticipant,
        batchDeleteParticipants,
        batchVerifyParticipants,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
