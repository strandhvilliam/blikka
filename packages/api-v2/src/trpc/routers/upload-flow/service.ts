import { Config, Effect, Option, Array, Order, pipe } from "effect";
import { type NewParticipant, type Participant, type Submission, type Topic, Database } from "@blikka/db";
import { S3Service } from "@blikka/s3";
import { UploadSessionRepository } from "@blikka/kv-store";
import { PubSubChannel, PubSubService, RunStateService } from "@blikka/pubsub";
import { UploadFlowApiError } from "./schemas";

export class UploadFlowApiService extends Effect.Service<UploadFlowApiService>()(
  "@blikka/api-v2/UploadFlowApiService",
  {
    accessors: true,
    dependencies: [
      Database.Default,
      S3Service.Default,
      UploadSessionRepository.Default,
      PubSubService.Default,
      RunStateService.Default,
    ],
    effect: Effect.gen(function*() {
      const db = yield* Database;
      const s3 = yield* S3Service;
      const kv = yield* UploadSessionRepository;
      const runStateService = yield* RunStateService;
      const bucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME");
      const environment = yield* Config.string("NODE_ENV").pipe(
        Config.map((env) => (env === "production" ? "prod" : "dev")),
      );

      const getPublicMarathon = Effect.fn(
        "UploadFlowApiService.getPublicMarathon",
      )(function*({ domain }) {
        return yield* db.marathonsQueries
          .getMarathonByDomainWithOptions({
            domain,
          })
          .pipe(
            Effect.andThen(
              Option.match({
                onSome: (marathon) => Effect.succeed(marathon),
                onNone: () =>
                  new UploadFlowApiError({
                    message: "Marathon not found",
                  }),
              }),
            ),
          );
      });

      const checkParticipantExists = Effect.fn(
        "UploadFlowApiService.checkParticipantExists",
      )(function*({ domain, reference }) {
        const existingState = yield* kv.getParticipantState(domain, reference);

        if (Option.isSome(existingState)) {
          return true;
        }

        return false;
      });

      const initializeUploadFlow = Effect.fn(
        "UploadFlowApiService.initializeUploadFlow",
      )(function*({
        domain,
        reference,
        firstname,
        lastname,
        email,
        competitionClassId,
        deviceGroupId,
      }) {
        const executeEffect = Effect.gen(function*() {
          const marathon = yield* db.marathonsQueries
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
                        message: "Marathon not found",
                      }),
                    ),
                }),
              ),
            );

          const competitionClass = yield* Array.findFirst(
            marathon.competitionClasses,
            (c) => c.id === competitionClassId,
          ).pipe(
            Option.match({
              onSome: (competitionClass) => Effect.succeed(competitionClass),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: "Competition class not found",
                  }),
                ),
            }),
          );

          yield* Array.findFirst(
            marathon.deviceGroups,
            (c) => c.id === deviceGroupId,
          ).pipe(
            Option.match({
              onSome: (deviceGroup) => Effect.succeed(deviceGroup),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: "Device group not found",
                  }),
                ),
            }),
          );

          const existingParticipant =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            });

          const existingSubmissions = Option.match(existingParticipant, {
            onSome: (existing) => existing.submissions.map((s) => s.id),
            onNone: () => [] as number[],
          });

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
          } satisfies NewParticipant;

          const participant: Participant = yield* Option.match(existingParticipant, {
            onSome: (existing) => {
              if (existing.status === "completed") {
                return Effect.fail(
                  new UploadFlowApiError({
                    message: "Participant already completed the marathon",
                  }),
                );
              }
              return db.participantsQueries.updateParticipantById({
                id: existing.id,
                data: participantData,
              })
            },
            onNone: () => {
              return db.participantsQueries.createParticipant({
                data: participantData,
              })
            },
          });

          const topics = pipe(
            marathon.topics,
            Array.sort(
              Order.mapInput(Order.number, (topic: Topic) => topic.orderIndex),
            ),
            Array.drop(competitionClass.topicStartIndex),
            Array.take(competitionClass.numberOfPhotos),
          );

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
            data: topics.map((topic, i) => ({
              participantId: participant.id,
              key: submissionKeys[i]!,
              marathonId: marathon.id,
              topicId: topic.id,
              status: "initialized",
            })),
          });

          yield* kv.initializeState(domain, reference, submissionKeys);

          const presignedUrls = yield* Effect.forEach(
            submissionKeys,
            (key) => s3.getPresignedUrl(bucketName, key, "PUT"),
            { concurrency: "unbounded" },
          );

          return Array.zip(submissionKeys, presignedUrls).map(([key, url]) => ({
            key,
            url,
          }));
        });

        const channel = yield* PubSubChannel.fromString(
          `${environment}:upload-flow:${domain}-${reference}`,
        );

        return yield* runStateService.withRunStateEvents({
          taskName: "upload-initializer",
          channel,
          effect: executeEffect,
          metadata: {
            domain,
            reference,
          },
        });
      });

      const getUploadStatus = Effect.fn("UploadFlowApiService.getUploadStatus")(
        function*({ domain, reference, orderIndexes }) {
          const participantState = yield* kv.getParticipantState(domain, reference);
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

      // By-camera mode: single photo upload without competition class
      const initializeByCameraUpload = Effect.fn(
        "UploadFlowApiService.initializeByCameraUpload",
      )(function*({
        domain,
        reference,
        firstname,
        lastname,
        email,
      }) {
        const executeEffect = Effect.gen(function*() {
          const marathon = yield* db.marathonsQueries
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
                        message: "Marathon not found",
                      }),
                    ),
                }),
              ),
            );

          const existingParticipant =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            });

          const existingSubmissions = Option.match(existingParticipant, {
            onSome: (existing) => existing.submissions.map((s) => s.id),
            onNone: () => [] as number[],
          });

          // For by-camera mode, no competition class or device group at initialization
          const participantData = {
            reference,
            domain,
            competitionClassId: null,
            deviceGroupId: null,
            marathonId: marathon.id,
            firstname,
            lastname,
            email,
            status: "initialized",
          } satisfies NewParticipant;

          const participant: Participant = yield* Option.match(existingParticipant, {
            onSome: (existing) => {
              if (existing.status === "completed") {
                return Effect.fail(
                  new UploadFlowApiError({
                    message: "Participant already completed",
                  }),
                );
              }
              return db.participantsQueries.updateParticipantById({
                id: existing.id,
                data: participantData,
              })
            },
            onNone: () => {
              return db.participantsQueries.createParticipant({
                data: participantData,
              })
            },
          });

          // By-camera mode: single photo with orderIndex 0
          // Use the first topic from the marathon for the submission
          const sortedTopics = pipe(
            marathon.topics,
            Array.sort(
              Order.mapInput(Order.number, (topic: Topic) => topic.orderIndex),
            ),
          );

          const firstTopic = yield* Array.head(sortedTopics).pipe(
            Option.match({
              onSome: (topic) => Effect.succeed(topic),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: "No topics found for marathon",
                  }),
                ),
            }),
          );

          const orderIndex = firstTopic.orderIndex;
          const submissionKey = yield* s3.generateSubmissionKey(domain, reference, orderIndex);

          if (existingSubmissions.length > 0) {
            yield* db.submissionsQueries.deleteMultipleSubmissions({
              ids: existingSubmissions,
            });
          }

          // Create submission with the first topic (by-camera mode uses first topic)
          yield* db.submissionsQueries.createMultipleSubmissions({
            data: [{
              participantId: participant.id,
              key: submissionKey,
              marathonId: marathon.id,
              topicId: firstTopic.id,
              status: "initialized",
            }],
          });

          yield* kv.initializeState(domain, reference, [submissionKey]);

          const presignedUrl = yield* s3.getPresignedUrl(bucketName, submissionKey, "PUT");

          return [{
            key: submissionKey,
            url: presignedUrl,
          }];
        });

        const channel = yield* PubSubChannel.fromString(
          `${environment}:upload-flow:${domain}-${reference}`,
        );

        return yield* runStateService.withRunStateEvents({
          taskName: "by-camera-upload-initializer",
          channel,
          effect: executeEffect,
          metadata: {
            domain,
            reference,
          },
        });
      });

      // Finalize by-camera upload: set device group and mark as verified
      const finalizeByCameraUpload = Effect.fn(
        "UploadFlowApiService.finalizeByCameraUpload",
      )(function*({
        domain,
        reference,
        deviceGroupId,
      }) {
        const marathon = yield* db.marathonsQueries
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
                      message: "Marathon not found",
                    }),
                  ),
              }),
            ),
          );

        // Validate device group exists
        yield* Array.findFirst(
          marathon.deviceGroups,
          (dg) => dg.id === deviceGroupId,
        ).pipe(
          Option.match({
            onSome: (deviceGroup) => Effect.succeed(deviceGroup),
            onNone: () =>
              Effect.fail(
                new UploadFlowApiError({
                  message: "Device group not found",
                }),
              ),
          }),
        );

        const existingParticipant =
          yield* db.participantsQueries.getParticipantByReference({
            reference,
            domain,
          });

        const participant = yield* Option.match(existingParticipant, {
          onSome: (p) => Effect.succeed(p),
          onNone: () =>
            Effect.fail(
              new UploadFlowApiError({
                message: "Participant not found",
              }),
            ),
        });

        // Update participant with device group and mark as verified (skipping verification step)
        yield* db.participantsQueries.updateParticipantById({
          id: participant.id,
          data: {
            deviceGroupId,
            status: "verified",
          },
        });

        return { success: true };
      });

      return {
        initializeUploadFlow,
        initializeByCameraUpload,
        finalizeByCameraUpload,
        getPublicMarathon,
        checkParticipantExists,
        getUploadStatus,
      } as const;
    }),
  },
) {
}
