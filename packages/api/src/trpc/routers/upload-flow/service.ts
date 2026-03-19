import {
  Array,
  Config,
  Effect,
  Layer,
  Option,
  Order,
  pipe,
  ServiceMap,
} from "effect";
import {
  type CompetitionClass,
  type Marathon,
  type NewParticipant,
  type Participant,
  type Topic,
  Database,
} from "@blikka/db";
import { S3Service, SQSService } from "@blikka/aws";
import { UploadSessionRepository } from "@blikka/kv-store";
import { RealtimeEventsService } from "@blikka/realtime";
import { UploadFlowApiError, normalizeUploadContentType } from "./schemas";
import { PhoneNumberEncryptionService } from "../../utils/phone-number-encryption";

const ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE =
  "You have already uploaded a photo for the current topic.";

const MAX_REFERENCE_GENERATION_ATTEMPTS = 25;

function createRandomReference() {
  return Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");
}

function normalizeOptionalPhoneNumber(phoneNumber?: string | null) {
  const normalizedPhoneNumber = phoneNumber?.trim();

  return normalizedPhoneNumber ? normalizedPhoneNumber : null;
}

export class UploadFlowApiService extends ServiceMap.Service<UploadFlowApiService>()(
  "@blikka/api/UploadFlowApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database;
      const s3 = yield* S3Service;
      const sqs = yield* SQSService;
      const kv = yield* UploadSessionRepository;
      const phoneEncryption = yield* PhoneNumberEncryptionService;
      const realtimeEvents = yield* RealtimeEventsService;
      const bucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME");
      const queueUrl = yield* Config.string("UPLOAD_PROCESSOR_QUEUE_URL");
      const environment = yield* Config.string("NODE_ENV").pipe(
        Config.map((env) => (env === "production" ? "prod" : "dev")),
      );

      const getMarathonByDomainOrFail = Effect.fn(
        "UploadFlowApiService.getMarathonByDomainOrFail",
      )(function* (domain: string) {
        return yield* db.marathonsQueries
          .getMarathonByDomainWithOptions({
            domain,
          })
          .pipe(
            Effect.andThen(
              Option.match({
                onSome: (marathon) => Effect.succeed(marathon),
                onNone: () =>
                  Effect.fail(
                    new UploadFlowApiError({
                      message: `[${domain}] Marathon not found`,
                    }),
                  ),
              }),
            ),
          );
      });

      const ensureMarathonIsOpenForUploads = Effect.fn(
        "UploadFlowApiService.ensureMarathonIsOpenForUploads",
      )(function* ({
        domain,
        marathon,
        activeTopic,
      }: {
        domain: string;
        marathon: Marathon;
        activeTopic?: Topic | null;
      }) {
        if (!marathon.setupCompleted) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Marathon setup is incomplete`,
            }),
          );
        }

        if (marathon.mode === "marathon") {
          if (!marathon.startDate || !marathon.endDate) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Marathon upload window is not configured`,
              }),
            );
          }

          const startDate = new Date(marathon.startDate);
          const endDate = new Date(marathon.endDate);
          const now = new Date();

          if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
          ) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Marathon upload window is invalid`,
              }),
            );
          }

          if (now < startDate || now > endDate) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Uploads are closed for this marathon`,
              }),
            );
          }
        }

        if (marathon.mode === "by-camera") {
          if (!activeTopic) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] No active topic found for marathon`,
              }),
            );
          }
          if (activeTopic.visibility !== "active") {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Active topic is not active`,
              }),
            );
          }
          if (!activeTopic.scheduledStart) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Active topic has not been opened for submissions`,
              }),
            );
          }
          if (new Date(activeTopic.scheduledStart) > new Date()) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Submissions are scheduled to open later`,
              }),
            );
          }
          if (
            activeTopic.scheduledEnd &&
            new Date(activeTopic.scheduledEnd) <= new Date()
          ) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Submissions are closed for this topic`,
              }),
            );
          }
        }
      });

      const getActiveByCameraTopicOrFail = Effect.fn(
        "UploadFlowApiService.getActiveByCameraTopicOrFail",
      )(function* ({
        domain,
        marathon,
      }: {
        domain: string;
        marathon: {
          topics: Topic[];
        };
      }) {
        const activeTopic = marathon.topics.find(
          (topic) => topic.visibility === "active",
        );

        if (!activeTopic) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] No active topic found for marathon`,
            }),
          );
        }

        return activeTopic;
      });

      const getByCameraCompetitionClassIdOrFail = Effect.fn(
        "UploadFlowApiService.getByCameraCompetitionClassIdOrFail",
      )(function* ({
        domain,
        marathon,
      }: {
        domain: string;
        marathon: { competitionClasses: CompetitionClass[] };
      }) {
        const competitionClass = marathon.competitionClasses.find(
          (resolvedCompetitionClass) =>
            resolvedCompetitionClass.numberOfPhotos === 1,
        );

        if (!competitionClass) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Competition class not found`,
            }),
          );
        }

        return competitionClass.id;
      });

      const ensureDeviceGroupExists = Effect.fn(
        "UploadFlowApiService.ensureDeviceGroupExists",
      )(function* ({
        domain,
        marathon,
        deviceGroupId,
      }: {
        domain: string;
        marathon: {
          deviceGroups: {
            id: number;
          }[];
        };
        deviceGroupId: number;
      }) {
        const deviceGroup = marathon.deviceGroups.find(
          (resolvedDeviceGroup) => resolvedDeviceGroup.id === deviceGroupId,
        );

        if (!deviceGroup) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Device group not found`,
            }),
          );
        }

        return deviceGroup;
      });

      const getCompetitionClassOrFail = Effect.fn(
        "UploadFlowApiService.getCompetitionClassOrFail",
      )(function* ({
        domain,
        marathon,
        competitionClassId,
      }: {
        domain: string;
        marathon: { competitionClasses: CompetitionClass[] };
        competitionClassId: number;
      }) {
        const competitionClass = marathon.competitionClasses.find(
          (resolvedCompetitionClass) =>
            resolvedCompetitionClass.id === competitionClassId,
        );

        if (!competitionClass) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Competition class not found`,
            }),
          );
        }

        return competitionClass;
      });

      const encryptPhoneNumber = Effect.fn(
        "UploadFlowApiService.encryptPhoneNumber",
      )(function* (phoneNumber?: string | null) {
        return yield* Option.match(
          Option.fromNullishOr(normalizeOptionalPhoneNumber(phoneNumber)),
          {
            onSome: (resolvedPhoneNumber) =>
              phoneEncryption.encrypt({ phoneNumber: resolvedPhoneNumber }),
            onNone: () =>
              Effect.succeed<{ encrypted: null; hash: null }>({
                encrypted: null,
                hash: null,
              }),
          },
        );
      });

      const hasSuccessfulActiveTopicUpload = Effect.fn(
        "UploadFlowApiService.hasSuccessfulActiveTopicUpload",
      )(function* ({
        domain,
        reference,
        activeTopic,
        submissionStatus,
      }: {
        domain: string;
        reference: string;
        activeTopic: { id: number; orderIndex: number; visibility: string };
        submissionStatus?: string | null;
      }) {
        if (submissionStatus && submissionStatus !== "initialized") {
          return true;
        }

        const participantState = yield* kv.getParticipantState(
          domain,
          reference,
        );
        const submissionState = yield* kv.getSubmissionState(
          domain,
          reference,
          activeTopic.orderIndex,
        );

        if (
          Option.isSome(participantState) &&
          participantState.value.finalized &&
          participantState.value.orderIndexes.includes(activeTopic.orderIndex)
        ) {
          return true;
        }

        if (Option.isSome(submissionState)) {
          const state = submissionState.value;
          return (
            state.uploaded || state.exifProcessed || state.thumbnailKey !== null
          );
        }

        return false;
      });

      const resolveExistingByCameraParticipant = Effect.fn(
        "UploadFlowApiService.resolveExistingByCameraParticipant",
      )(function* ({
        domain,
        phoneNumber,
      }: {
        domain: string;
        phoneNumber: string;
      }) {
        const marathon = yield* getMarathonByDomainOrFail(domain);

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Marathon is not in by-camera mode`,
            }),
          );
        }

        const activeTopic = yield* getActiveByCameraTopicOrFail({
          domain,
          marathon,
        });
        const phoneHash = yield* phoneEncryption.hashLookup({ phoneNumber });
        const existingParticipant =
          yield* db.participantsQueries.getByPhoneHashForByCamera({
            marathonId: marathon.id,
            phoneHash,
          });

        if (Option.isNone(existingParticipant)) {
          return {
            marathon,
            activeTopic,
            phoneHash,
            existingParticipant: null,
            activeTopicSubmission: null,
            activeTopicUploadState: "eligible" as const,
          };
        }

        const activeTopicSubmission = yield* db.submissionsQueries
          .getSubmissionByParticipantIdAndTopicId({
            participantId: existingParticipant.value.id,
            topicId: activeTopic.id,
          })
          .pipe(
            Effect.map((submission) =>
              Option.match(submission, {
                onSome: (value) => value,
                onNone: () => null,
              }),
            ),
          );

        const alreadyUploaded = yield* hasSuccessfulActiveTopicUpload({
          domain,
          reference: existingParticipant.value.reference,
          activeTopic,
          submissionStatus: activeTopicSubmission?.status,
        });

        return {
          marathon,
          activeTopic,
          phoneHash,
          existingParticipant: existingParticipant.value,
          activeTopicSubmission,
          activeTopicUploadState: alreadyUploaded
            ? ("already-uploaded" as const)
            : ("eligible" as const),
        };
      });

      const createByCameraParticipantWithGeneratedReference = Effect.fn(
        "UploadFlowApiService.createByCameraParticipantWithGeneratedReference",
      )(function* ({
        domain,
        marathonId,
        competitionClassId,
        deviceGroupId,
        firstname,
        lastname,
        email,
        phoneHash,
        phoneEncrypted,
      }: {
        domain: string;
        marathonId: number;
        competitionClassId: number;
        deviceGroupId: number;
        firstname: string;
        lastname: string;
        email: string;
        phoneHash: string;
        phoneEncrypted: string;
      }) {
        for (
          let attempt = 0;
          attempt < MAX_REFERENCE_GENERATION_ATTEMPTS;
          attempt += 1
        ) {
          const reference = createRandomReference();
          const existingReference =
            yield* db.participantsQueries.getParticipantByReference({
              domain,
              reference,
            });

          if (Option.isSome(existingReference)) {
            continue;
          }

          const participantData = {
            reference,
            domain,
            competitionClassId,
            deviceGroupId,
            marathonId,
            participantMode: "by-camera",
            firstname,
            lastname,
            email,
            status: "initialized",
            phoneHash,
            phoneEncrypted,
          } satisfies NewParticipant;

          const created = yield* db.participantsQueries
            .createParticipant({ data: participantData })
            .pipe(
              Effect.map((participant) => ({ participant, reference })),
              Effect.catch((error) => {
                const message =
                  error instanceof Error ? error.message : String(error);
                if (message.includes("participants_domain_reference_key")) {
                  return Effect.succeed(null);
                }
                return Effect.fail(error);
              }),
            );

          if (created) {
            return created;
          }
        }

        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Failed to allocate a unique participant reference`,
          }),
        );
      });

      const getPublicMarathon = Effect.fn(
        "UploadFlowApiService.getPublicMarathon",
      )(function* ({ domain }) {
        const marathon = yield* getMarathonByDomainOrFail(domain);

        const processedTopics = marathon.topics
          .reduce((acc, topic) => {
            if (
              topic.visibility !== "public" &&
              topic.visibility !== "active"
            ) {
              acc.push({
                ...topic,
                name: "Redacted",
              });
            } else {
              acc.push(topic);
            }
            return acc;
          }, [] as Topic[])
          .sort((a, b) => a.orderIndex - b.orderIndex);

        const topics =
          marathon.mode === "by-camera"
            ? processedTopics
                .filter((topic) => topic.visibility === "active")
                .slice(0, 1)
            : processedTopics;

        return {
          ...marathon,
          topics,
        };
      });

      const checkParticipantExists = Effect.fn(
        "UploadFlowApiService.checkParticipantExists",
      )(function* ({ domain, reference }) {
        const participant =
          yield* db.participantsQueries.getParticipantByReference({
            domain,
            reference,
          });

        return Option.match(participant, {
          onSome: (existingParticipant) => ({
            exists: true as const,
            status: existingParticipant.status,
          }),
          onNone: () => ({
            exists: false as const,
            status: null,
          }),
        });
      });

      const prepareUploadFlow = Effect.fn(
        "UploadFlowApiService.prepareUploadFlow",
      )(function* ({
        domain,
        reference,
        firstname,
        lastname,
        email,
        competitionClassId,
        deviceGroupId,
        phoneNumber,
      }) {
        const executeEffect = Effect.gen(function* () {
          const marathon = yield* getMarathonByDomainOrFail(domain);

          if (marathon.mode !== "marathon") {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Prepare flow is only available in marathon mode`,
              }),
            );
          }

          yield* getCompetitionClassOrFail({
            domain,
            marathon,
            competitionClassId,
          });
          yield* ensureDeviceGroupExists({
            domain,
            marathon,
            deviceGroupId,
          });

          const existingParticipant =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            });

          if (Option.isSome(existingParticipant)) {
            if (
              existingParticipant.value.status === "completed" ||
              existingParticipant.value.status === "verified"
            ) {
              return yield* Effect.fail(
                new UploadFlowApiError({
                  message: `[${domain}|${reference}] Participant already completed upload flow`,
                }),
              );
            }

            if (existingParticipant.value.status === "initialized") {
              return yield* Effect.fail(
                new UploadFlowApiError({
                  message: `[${domain}|${reference}] Participant already started upload flow`,
                }),
              );
            }
          }

          const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber);

          const participantData = {
            reference,
            domain,
            competitionClassId,
            deviceGroupId,
            marathonId: marathon.id,
            firstname,
            lastname,
            email,
            status: "prepared",
            phoneHash: hash,
            phoneEncrypted: encrypted,
          } satisfies NewParticipant;

          const participant = yield* Option.match(existingParticipant, {
            onSome: (existing) =>
              db.participantsQueries.updateParticipantById({
                id: existing.id,
                data: participantData,
              }),
            onNone: () =>
              db.participantsQueries.createParticipant({
                data: participantData,
              }),
          });

          return {
            participantId: participant.id,
            status: participant.status,
          };
        });

        return yield* realtimeEvents.withEventResult(executeEffect, {
          eventKey: "participant-prepared",
          environment,
          domain,
          reference,
        });
      });

      const initializeUploadFlow = Effect.fn(
        "UploadFlowApiService.initializeUploadFlow",
      )(function* ({
        domain,
        reference,
        firstname,
        lastname,
        email,
        competitionClassId,
        deviceGroupId,
        phoneNumber,
        uploadContentTypes,
      }) {
        const executeEffect = Effect.gen(function* () {
          const marathon = yield* getMarathonByDomainOrFail(domain);

          yield* ensureMarathonIsOpenForUploads({
            domain,
            marathon,
          });

          const competitionClass = yield* getCompetitionClassOrFail({
            domain,
            marathon,
            competitionClassId,
          });

          yield* ensureDeviceGroupExists({
            domain,
            marathon,
            deviceGroupId,
          });

          const existingParticipant =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            });

          const existingSubmissions = Option.match(existingParticipant, {
            onSome: (existing) =>
              existing.submissions.map((submission) => submission.id),
            onNone: () => [] as number[],
          });

          const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber);

          const participantData = {
            reference,
            domain,
            competitionClassId,
            deviceGroupId,
            marathonId: marathon.id,
            firstname,
            lastname,
            email,
            status: "initialized",
            phoneHash: hash,
            phoneEncrypted: encrypted,
          } satisfies NewParticipant;

          const participant: Participant = yield* Option.match(
            existingParticipant,
            {
              onSome: (existing) => {
                if (
                  existing.status === "completed" ||
                  existing.status === "verified"
                ) {
                  return Effect.fail(
                    new UploadFlowApiError({
                      message: `[${domain}|${reference}] Participant already completed upload flow`,
                    }),
                  );
                }
                return db.participantsQueries.updateParticipantById({
                  id: existing.id,
                  data: participantData,
                });
              },
              onNone: () =>
                db.participantsQueries.createParticipant({
                  data: participantData,
                }),
            },
          );

          const topics = pipe(
            marathon.topics,
            Array.sort(
              Order.mapInput(Order.Number, (topic: Topic) => topic.orderIndex),
            ),
            Array.drop(competitionClass.topicStartIndex),
            Array.take(competitionClass.numberOfPhotos),
          );

          if (
            uploadContentTypes !== undefined &&
            uploadContentTypes.length !== topics.length
          ) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}|${reference}] uploadContentTypes length must match the number of submissions (${topics.length})`,
              }),
            );
          }

          const submissionKeys = yield* Effect.forEach(
            topics,
            (topic) =>
              s3.generateSubmissionKey(domain, reference, topic.orderIndex),
            { concurrency: "unbounded" },
          );

          if (existingSubmissions.length > 0) {
            yield* db.submissionsQueries.deleteMultipleSubmissions({
              ids: existingSubmissions,
            });
          }

          yield* db.submissionsQueries.createMultipleSubmissions({
            data: topics.map((topic, index) => ({
              participantId: participant.id,
              key: submissionKeys[index]!,
              marathonId: marathon.id,
              topicId: topic.id,
              status: "initialized",
            })),
          });

          yield* kv.initializeState(domain, reference, submissionKeys);

          const resolvedContentTypes =
            uploadContentTypes === undefined
              ? topics.map(() => "image/jpeg")
              : uploadContentTypes.map((raw: string) =>
                  normalizeUploadContentType(raw),
                );

          const presignedUrls = yield* Effect.forEach(
            submissionKeys.map((key, index) => ({
              key,
              contentType: resolvedContentTypes[index]!,
            })),
            ({ key, contentType }) =>
              s3.getPresignedUrl(bucketName, key, "PUT", { contentType }),
            { concurrency: "unbounded" },
          );

          return submissionKeys.map((key, index) => ({
            key,
            url: presignedUrls[index]!,
            contentType: resolvedContentTypes[index]!,
          }));
        });

        return yield* realtimeEvents.withEventResult(executeEffect, {
          eventKey: "upload-flow-initialized",
          environment,
          domain,
          reference,
        });
      });

      const resolveByCameraParticipantByPhone = Effect.fn(
        "UploadFlowApiService.resolveByCameraParticipantByPhone",
      )(function* ({ domain, phoneNumber }) {
        const resolved = yield* resolveExistingByCameraParticipant({
          domain,
          phoneNumber,
        });

        if (!resolved.existingParticipant) {
          return {
            match: false as const,
          };
        }

        return {
          match: true as const,
          participantId: resolved.existingParticipant.id,
          reference: resolved.existingParticipant.reference,
          activeTopicUploadState: resolved.activeTopicUploadState,
        };
      });

      const getUploadStatus = Effect.fn("UploadFlowApiService.getUploadStatus")(
        function* ({ domain, reference, orderIndexes }) {
          const participantState = yield* kv.getParticipantState(
            domain,
            reference,
          );
          const submissionStates = yield* kv.getAllSubmissionStates(
            domain,
            reference,
            orderIndexes,
          );

          return {
            participant: Option.match(participantState, {
              onSome: (state) => ({
                expectedCount: state.expectedCount,
                processedIndexes: state.processedIndexes,
                validated: state.validated,
                finalized: state.finalized,
                errors: state.errors,
              }),
              onNone: () => null,
            }),
            submissions: submissionStates.map((state) => ({
              key: state.key,
              orderIndex: state.orderIndex,
              uploaded: state.uploaded,
              thumbnailKey: state.thumbnailKey,
              exifProcessed: state.exifProcessed,
            })),
          };
        },
      );

      const initializeByCameraUpload = Effect.fn(
        "UploadFlowApiService.initializeByCameraUpload",
      )(function* ({
        domain,
        firstname,
        lastname,
        deviceGroupId,
        email,
        phoneNumber,
        replaceExistingActiveTopicUpload,
      }) {
        const executeEffect = Effect.gen(function* () {
          const resolved = yield* resolveExistingByCameraParticipant({
            domain,
            phoneNumber,
          });

          const { marathon, activeTopic } = resolved;
          yield* ensureMarathonIsOpenForUploads({
            domain,
            marathon,
            activeTopic,
          });

          yield* ensureDeviceGroupExists({
            domain,
            marathon,
            deviceGroupId,
          });

          if (
            resolved.activeTopicUploadState === "already-uploaded" &&
            !replaceExistingActiveTopicUpload
          ) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE,
              }),
            );
          }

          const competitionClassId = yield* getByCameraCompetitionClassIdOrFail(
            {
              domain,
              marathon,
            },
          );

          const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber);

          if (!encrypted || !hash) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}] Phone number is required`,
              }),
            );
          }

          let participant: Participant;
          let reference: string;

          if (resolved.existingParticipant) {
            participant = yield* db.participantsQueries.updateParticipantById({
              id: resolved.existingParticipant.id,
              data: {
                competitionClassId,
                deviceGroupId,
                firstname,
                lastname,
                email,
                participantMode: "by-camera",
                status: "initialized",
                phoneHash: hash,
                phoneEncrypted: encrypted,
              },
            });
            reference = resolved.existingParticipant.reference;
          } else {
            const created =
              yield* createByCameraParticipantWithGeneratedReference({
                domain,
                marathonId: marathon.id,
                competitionClassId,
                deviceGroupId,
                firstname,
                lastname,
                email,
                phoneHash: hash,
                phoneEncrypted: encrypted,
              });
            participant = created.participant;
            reference = created.reference;
          }

          if (resolved.activeTopicSubmission) {
            yield* db.submissionsQueries.deleteSubmissionById({
              id: resolved.activeTopicSubmission.id,
            });
          }

          const submissionKey = yield* s3.generateSubmissionKey(
            domain,
            reference,
            activeTopic.orderIndex,
          );

          yield* db.submissionsQueries.createSubmission({
            data: {
              participantId: participant.id,
              key: submissionKey,
              marathonId: marathon.id,
              topicId: activeTopic.id,
              status: "initialized",
            },
          });

          yield* kv.initializeState(domain, reference, [submissionKey]);

          const presignedUrl = yield* s3.getPresignedUrl(
            bucketName,
            submissionKey,
            "PUT",
          );

          return {
            participantId: participant.id,
            reference,
            uploads: [
              {
                key: submissionKey,
                url: presignedUrl,
              },
            ],
          };
        });

        return yield* realtimeEvents.withEventResult(executeEffect, {
          eventKey: "upload-flow-initialized",
          environment,
          domain,
        });
      });

      const reTriggerUploadFlow = Effect.fn(
        "UploadFlowApiService.reTriggerUploadFlow",
      )(function* ({ domain, reference }) {
        const participantState = yield* kv.getParticipantState(
          domain,
          reference,
        );
        if (Option.isNone(participantState)) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}|${reference}] Participant not initialized`,
            }),
          );
        }

        const submissionStates = yield* kv.getAllSubmissionStates(
          domain,
          reference,
          [...participantState.value.orderIndexes],
        );

        const submissionKeys = submissionStates.map((state) => state.key);

        yield* sqs.sendMessage(
          queueUrl,
          JSON.stringify({
            submissionKeys,
          }),
        );
      });

      return {
        initializeUploadFlow,
        prepareUploadFlow,
        initializeByCameraUpload,
        resolveByCameraParticipantByPhone,
        getPublicMarathon,
        checkParticipantExists,
        getUploadStatus,
        reTriggerUploadFlow,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        Database.layer,
        S3Service.layer,
        SQSService.layer,
        UploadSessionRepository.layer,
        RealtimeEventsService.layer,
        PhoneNumberEncryptionService.layer,
      ),
    ),
  );
}
