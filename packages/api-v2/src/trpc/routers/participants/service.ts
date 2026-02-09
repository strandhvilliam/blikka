import { Effect, Option } from "effect";
import { Database } from "@blikka/db";
import { ParticipantApiError, PublicParticipantSchema } from "./schemas";
import { PhoneNumberEncryptionService } from "../../utils/phone-number-encryption";
import type { NewParticipant } from "@blikka/db";

export class ParticipantsApiService extends Effect.Service<ParticipantsApiService>()(
  "@blikka/api-v2/ParticipantsApiService",
  {
    accessors: true,
    dependencies: [Database.Default, PhoneNumberEncryptionService.layer],
    effect: Effect.gen(function* () {
      const db = yield* Database;
      const phoneEncryption = yield* PhoneNumberEncryptionService;

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

        return PublicParticipantSchema.make({
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
        });
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
        hasValidationErrors,
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
          hasValidationErrors,
        });
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
          return yield* db.participantsQueries.batchVerifyParticipants({
            ids: [...ids],
            domain,
          });
        },
      );

      const verifyParticipant = Effect.fn(
        "ParticipantsApiService.verifyParticipant",
      )(function* ({ id, domain }: { id: number; domain: string }) {
        return yield* db.participantsQueries.batchVerifyParticipants({
          ids: [id],
          domain,
        });
      });

      return {
        getPublicParticipantByReference,
        getInfiniteParticipantsByDomain,
        getByReference,
        deleteByReference,
        createParticipant,
        batchDelete,
        batchVerify,
        verifyParticipant,
      } as const;
    }),
  },
) {}
