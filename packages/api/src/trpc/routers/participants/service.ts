import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import { Database } from "@blikka/db";
import { RealtimeEventsService } from "@blikka/realtime";
import { ParticipantApiError, PublicParticipantSchema } from "./schemas";
import { getRealtimeChannelEnvironmentFromNodeEnv } from "@blikka/realtime/contract";
import { PhoneNumberEncryptionService } from "../../utils/phone-number-encryption";
import type { NewParticipant } from "@blikka/db";
import { EmailService } from "@blikka/email";
import { sendParticipantVerifiedEmail } from "./notifications";

export class ParticipantsApiService extends ServiceMap.Service<ParticipantsApiService>()(
  "@blikka/api/ParticipantsApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database;
      const phoneEncryption = yield* PhoneNumberEncryptionService;
      const realtimeEvents = yield* RealtimeEventsService;
      const environment = getRealtimeChannelEnvironmentFromNodeEnv(
        yield* Config.string("NODE_ENV").pipe(
          Config.withDefault("development"),
        ),
      );

      const getPublicParticipantByReference = Effect.fn(
        "ParticipantsApiService.getPublicParticipantByReference",
      )(function* ({ reference, domain }) {
        const result = yield* db.participantsQueries.getParticipantByReference({
          reference,
          domain,
        });

        if (Option.isNone(result)) {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "Participant not found",
            }),
          );
        }

        return {
          reference: result.value.reference,
          domain: result.value.domain,
          status: result.value.status,
          publicSubmissions: result.value.submissions.map((submission) => ({
            topic: {
              name:
                submission.topic.visibility === "public" ||
                submission.topic.visibility === "active"
                  ? submission.topic.name
                  : "",
              orderIndex: submission.topic.orderIndex,
            },
            status: submission.status,
            createdAt: submission.createdAt,
            key: submission.key,
            thumbnailKey: submission.thumbnailKey,
          })),
          competitionClass: {
            name: result.value.competitionClass?.name ?? "",
            description: result.value.competitionClass?.description ?? "",
          },
          deviceGroup: {
            name: result.value.deviceGroup?.name ?? "",
            description: result.value.deviceGroup?.description ?? "",
            icon: result.value.deviceGroup?.icon ?? "",
          },
        };
      });

      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsApiService.getInfiniteParticipantsByDomain",
      )(function* ({
        domain,
        cursor,
        limit,
        search,
        sortOrder,
        competitionClassId,
        deviceGroupId,
        topicId,
        statusFilter,
        excludeStatuses,
        includeStatuses,
        hasValidationErrors,
        votedFilter,
      }) {
        return yield* db.participantsQueries.getInfiniteParticipantsByDomain({
          domain,
          cursor,
          limit,
          search,
          sortOrder,
          competitionClassId,
          deviceGroupId,
          topicId,
          statusFilter,
          excludeStatuses,
          includeStatuses,
          hasValidationErrors,
          votedFilter,
        });
      });

      const getDashboardOverview = Effect.fn(
        "ParticipantsApiService.getDashboardOverview",
      )(function* ({ domain }: { domain: string }) {
        return yield* db.participantsQueries.getDashboardOverview({ domain });
      });

      const getByReference = Effect.fn("ParticipantsApiService.getByReference")(
        function* ({ reference, domain }) {
          const result =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            });

          if (Option.isNone(result)) {
            return yield* Effect.fail(
              new ParticipantApiError({
                message: "Participant not found",
              }),
            );
          }
          return result.value;
        },
      );

      const deleteByReference = Effect.fn(
        "ParticipantsApiService.deleteByReference",
      )(function* ({ reference, domain }) {
        const participant = yield* getByReference({ reference, domain });
        return yield* db.participantsQueries.deleteParticipant({
          id: participant.id,
        });
      });

      const createParticipant = Effect.fn(
        "ParticipantsApiService.createParticipant",
      )(function* ({
        data,
        phoneNumber,
      }: {
        data: Omit<NewParticipant, "phoneHash" | "phoneEncrypted">;
        phoneNumber?: string;
      }) {
        let participantData: NewParticipant = {
          ...data,
          phoneHash: null,
          phoneEncrypted: null,
        };

        // If a phone number is provided, encrypt it and store both hash and encrypted value
        if (phoneNumber) {
          const { hash, encrypted } = yield* phoneEncryption.encrypt({
            phoneNumber,
          });
          participantData = {
            ...participantData,
            phoneHash: hash,
            phoneEncrypted: encrypted,
          };
        }

        const result = yield* db.participantsQueries.createParticipant({
          data: participantData,
        });

        return result;
      });

      const batchDelete = Effect.fn("ParticipantsApiService.batchDelete")(
        function* ({
          ids,
          domain,
        }: {
          ids: readonly number[];
          domain: string;
        }) {
          return yield* db.participantsQueries.batchDeleteParticipants({
            ids: [...ids],
            domain,
          });
        },
      );

      const batchVerify = Effect.fn("ParticipantsApiService.batchVerify")(
        function* ({
          ids,
          domain,
        }: {
          ids: readonly number[];
          domain: string;
        }) {
          const result = yield* db.participantsQueries.batchVerifyParticipants({
            ids: [...ids],
            domain,
          });
          const marathon = Option.getOrUndefined(
            yield* db.marathonsQueries.getMarathonByDomain({
              domain,
            }),
          );

          yield* Effect.forEach(
            ids,
            (id) =>
              Effect.gen(function* () {
                if (result.failedIds.includes(id)) {
                  return;
                }

                const participant = yield* db.participantsQueries.getParticipantById({ id });
                if (Option.isNone(participant)) {
                  return;
                }

                yield* realtimeEvents.emitEventResult({
                  environment,
                  domain,
                  reference: participant.value.reference,
                  eventKey: "participant-verified",
                  outcome: "success",
                  timestamp: Date.now(),
                  channels: "participant",
                });

                if (!marathon) {
                  return;
                }

                yield* sendParticipantVerifiedEmail({
                  participantEmail: participant.value.email,
                  participantFirstName: participant.value.firstname,
                  participantLastName: participant.value.lastname,
                  participantReference: participant.value.reference,
                  marathonName: marathon.name,
                  marathonLogoUrl: marathon.logoUrl,
                  marathonMode: marathon.mode,
                });
              }),
            { concurrency: 10, discard: true },
          );

          return result;
        },
      );

      const batchMarkCompleted = Effect.fn(
        "ParticipantsApiService.batchMarkCompleted",
      )(function* ({
        ids,
        domain,
      }: {
        ids: readonly number[];
        domain: string;
      }) {
        return yield* db.participantsQueries.batchMarkParticipantsCompleted({
          ids: [...ids],
          domain,
        });
      });

      const verifyParticipant = Effect.fn(
        "ParticipantsApiService.verifyParticipant",
      )(function* ({ id, domain }: { id: number; domain: string }) {
        const result = yield* db.participantsQueries.batchVerifyParticipants({
          ids: [id],
          domain,
        });

        if (result.updatedCount > 0) {
          const participant = yield* db.participantsQueries.getParticipantById({ id });
          const marathon = Option.getOrUndefined(
            yield* db.marathonsQueries.getMarathonByDomain({
              domain,
            }),
          );

          if (Option.isSome(participant)) {
            yield* realtimeEvents.emitEventResult({
              environment,
              domain,
              reference: participant.value.reference,
              eventKey: "participant-verified",
              outcome: "success",
              timestamp: Date.now(),
              channels: "participant",
            });

            if (marathon) {
              yield* sendParticipantVerifiedEmail({
                participantEmail: participant.value.email,
                participantFirstName: participant.value.firstname,
                participantLastName: participant.value.lastname,
                participantReference: participant.value.reference,
                marathonName: marathon.name,
                marathonLogoUrl: marathon.logoUrl,
                marathonMode: marathon.mode,
              });
            }
          }
        }

        return result;
      });

      return {
        getPublicParticipantByReference,
        getInfiniteParticipantsByDomain,
        getDashboardOverview,
        getByReference,
        deleteByReference,
        createParticipant,
        batchDelete,
        batchVerify,
        batchMarkCompleted,
        verifyParticipant,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      Database.layer,
      RealtimeEventsService.layer,
      PhoneNumberEncryptionService.layer,
      EmailService.layer,
    ))
  )
}
