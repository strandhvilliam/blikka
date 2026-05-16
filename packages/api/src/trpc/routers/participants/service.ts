import { Config, Effect, Layer, Option, Context } from "effect";
import {
  DbLayer,
  ParticipantsRepository,
  MarathonsRepository,
} from "@blikka/db";
import { RealtimeEventsService } from "@blikka/realtime";
import { ParticipantApiError, PublicParticipantSchema } from "./schemas";
import { getRealtimeChannelEnvironmentFromNodeEnv } from "@blikka/realtime/contract";
import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionService,
} from "../../utils/phone-number-encryption";
import type { NewParticipant } from "@blikka/db";
import { EmailService } from "@blikka/email";
import { sendParticipantVerifiedEmail } from "./notifications";

export class ParticipantsApiService extends Context.Service<ParticipantsApiService>()(
  "@blikka/api/ParticipantsApiService",
  {
    make: Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository;
      const participantsRepository = yield* ParticipantsRepository;
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
        const result = yield* participantsRepository.getParticipantByReference({
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
        const page =
          yield* participantsRepository.getInfiniteParticipantsByDomain({
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

        const participantsWithPhone = yield* Effect.forEach(
          page.participants,
          (participant) =>
            Effect.gen(function* () {
              const { phoneEncrypted, ...rest } = participant;
              const phoneNumber = yield* Option.match(
                Option.fromNullishOr(phoneEncrypted),
                {
                  onNone: () => Effect.succeed<string | null>(null),
                  onSome: (encrypted) =>
                    phoneEncryption
                      .decrypt({
                        encrypted: encrypted as EncryptedPhoneNumber,
                      })
                      .pipe(
                        Effect.catch(() => Effect.succeed<string | null>(null)),
                      ),
                },
              );
              return { ...rest, phoneNumber };
            }),
          { concurrency: 8 },
        );

        return {
          participants: participantsWithPhone,
          nextCursor: page.nextCursor,
        };
      });

      const getDashboardOverview = Effect.fn(
        "ParticipantsApiService.getDashboardOverview",
      )(function* ({ domain }: { domain: string }) {
        return yield* participantsRepository.getDashboardOverview({ domain });
      });

      const getByReference = Effect.fn("ParticipantsApiService.getByReference")(
        function* ({ reference, domain }) {
          const result =
            yield* participantsRepository.getParticipantByReference({
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
          const row = result.value;
          const phoneNumber = yield* Option.match(
            Option.fromNullishOr(row.phoneEncrypted),
            {
              onNone: () => Effect.succeed<string | null>(null),
              onSome: (encrypted) =>
                phoneEncryption
                  .decrypt({
                    encrypted: encrypted as EncryptedPhoneNumber,
                  })
                  .pipe(
                    Effect.catch(() => Effect.succeed<string | null>(null)),
                  ),
            },
          );
          return { ...row, phoneNumber };
        },
      );

      const deleteByReference = Effect.fn(
        "ParticipantsApiService.deleteByReference",
      )(function* ({ reference, domain }) {
        const participant = yield* getByReference({ reference, domain });
        return yield* participantsRepository.deleteParticipant({
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

        const result = yield* participantsRepository.createParticipant({
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
          return yield* participantsRepository.batchDeleteParticipants({
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
          const result = yield* participantsRepository.batchVerifyParticipants({
            ids: [...ids],
            domain,
          });
          const marathon = Option.getOrUndefined(
            yield* marathonsRepository.getMarathonByDomain({
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

                const participant =
                  yield* participantsRepository.getParticipantById({ id });
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
        return yield* participantsRepository.batchMarkParticipantsCompleted({
          ids: [...ids],
          domain,
        });
      });

      const updateByCameraParticipantContact = Effect.fn(
        "ParticipantsApiService.updateByCameraParticipantContact",
      )(function* ({
        domain,
        reference,
        firstname,
        lastname,
        email,
        phone,
      }: {
        domain: string;
        reference: string;
        firstname: string;
        lastname: string;
        email: string;
        phone: string;
      }) {
        const first = firstname.trim();
        const last = lastname.trim();
        const mail = email.trim();
        const phoneTrimmed = phone.trim();

        if (!first || !last || !mail || !phoneTrimmed) {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "First name, last name, email, and phone are required",
            }),
          );
        }

        const marathonOption = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });
        if (Option.isNone(marathonOption)) {
          return yield* Effect.fail(
            new ParticipantApiError({ message: "Marathon not found" }),
          );
        }
        const marathon = marathonOption.value;
        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "Marathon is not in by-camera mode",
            }),
          );
        }

        const participantOption =
          yield* participantsRepository.getParticipantByReference({
            reference,
            domain,
          });
        if (Option.isNone(participantOption)) {
          return yield* Effect.fail(
            new ParticipantApiError({ message: "Participant not found" }),
          );
        }
        const participant = participantOption.value;
        if (participant.participantMode !== "by-camera") {
          return yield* Effect.fail(
            new ParticipantApiError({
              message:
                "Only by-camera participants can be updated with this action",
            }),
          );
        }

        const phoneHash = yield* phoneEncryption.hashLookup({
          phoneNumber: phoneTrimmed,
        });
        const existingByPhone =
          yield* participantsRepository.getByPhoneHashForByCamera({
            marathonId: marathon.id,
            phoneHash,
          });
        if (
          Option.isSome(existingByPhone) &&
          existingByPhone.value.id !== participant.id
        ) {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "Another participant already uses this phone number",
            }),
          );
        }

        const { hash, encrypted } = yield* phoneEncryption.encrypt({
          phoneNumber: phoneTrimmed,
        });

        yield* participantsRepository.updateParticipantById({
          id: participant.id,
          data: {
            firstname: first,
            lastname: last,
            email: mail,
            phoneHash: hash,
            phoneEncrypted: encrypted,
            updatedAt: new Date().toISOString(),
          },
        });
      });

      const updateMarathonParticipantContact = Effect.fn(
        "ParticipantsApiService.updateMarathonParticipantContact",
      )(function* ({
        domain,
        reference,
        firstname,
        lastname,
        email,
      }: {
        domain: string;
        reference: string;
        firstname: string;
        lastname: string;
        email: string;
      }) {
        const first = firstname.trim();
        const last = lastname.trim();
        const mail = email.trim();

        if (!first || !last || !mail) {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "First name, last name, and email are required",
            }),
          );
        }

        const marathonOption = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });
        if (Option.isNone(marathonOption)) {
          return yield* Effect.fail(
            new ParticipantApiError({ message: "Marathon not found" }),
          );
        }
        const marathon = marathonOption.value;
        if (marathon.mode !== "marathon") {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "Marathon is not in classic marathon mode",
            }),
          );
        }

        const participantOption =
          yield* participantsRepository.getParticipantByReference({
            reference,
            domain,
          });
        if (Option.isNone(participantOption)) {
          return yield* Effect.fail(
            new ParticipantApiError({ message: "Participant not found" }),
          );
        }
        const participant = participantOption.value;
        if (participant.participantMode !== "marathon") {
          return yield* Effect.fail(
            new ParticipantApiError({
              message:
                "Only classic marathon participants can be updated with this action",
            }),
          );
        }

        yield* participantsRepository.updateParticipantById({
          id: participant.id,
          data: {
            firstname: first,
            lastname: last,
            email: mail,
            updatedAt: new Date().toISOString(),
          },
        });
      });

      const verifyParticipant = Effect.fn(
        "ParticipantsApiService.verifyParticipant",
      )(function* ({ id, domain }: { id: number; domain: string }) {
        const result = yield* participantsRepository.batchVerifyParticipants({
          ids: [id],
          domain,
        });

        if (result.updatedCount > 0) {
          const participant = yield* participantsRepository.getParticipantById({
            id,
          });
          const marathon = Option.getOrUndefined(
            yield* marathonsRepository.getMarathonByDomain({
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
        updateByCameraParticipantContact,
        updateMarathonParticipantContact,
        verifyParticipant,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        DbLayer,
        RealtimeEventsService.layer,
        PhoneNumberEncryptionService.layer,
        EmailService.layer,
      ),
    ),
  );
}
