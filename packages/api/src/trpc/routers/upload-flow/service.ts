import { Array, Config, Effect, Layer, Option, Order, pipe, ServiceMap } from "effect"
import { type NewParticipant, type Participant, type Submission, type Topic, Database } from "@blikka/db"
import { S3Service, SQSService } from "@blikka/aws"
import { UploadSessionRepository } from "@blikka/kv-store"
import { PubSubChannel, PubSubService, RunStateService } from "@blikka/pubsub"
import { UploadFlowApiError } from "./schemas"
import { PhoneNumberEncryptionService } from "../../utils/phone-number-encryption"

export class UploadFlowApiService extends ServiceMap.Service<UploadFlowApiService>()(
  "@blikka/api/UploadFlowApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service
      const sqs = yield* SQSService
      const kv = yield* UploadSessionRepository
      const phoneEncryption = yield* PhoneNumberEncryptionService
      const runStateService = yield* RunStateService
      const bucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
      const queueUrl = yield* Config.string("UPLOAD_PROCESSOR_QUEUE_URL")
      const environment = yield* Config.string("NODE_ENV").pipe(
        Config.map((env) => (env === "production" ? "prod" : "dev")),
      )

      const getPublicMarathon = Effect.fn(
        "UploadFlowApiService.getPublicMarathon",
      )(function* ({ domain }) {

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
                      message: `[${domain}] Marathon not found`,
                    }),
                  ),
              }),
            ),
          )

        const processedTopics = marathon.topics.reduce((acc, topic) => {
          if (topic.visibility !== "public" && topic.visibility !== "active") {
            acc.push({
              ...topic,
              name: "Redacted",
            })
          } else {
            acc.push(topic)
          }
          return acc
        }, [] as Topic[]).sort((a, b) => a.orderIndex - b.orderIndex)

        const topics = marathon.mode === "by-camera"
          ? processedTopics
            .filter((topic) => topic.visibility === "active")
            .slice(0, 1)
          : processedTopics


        const publicMarathon = {
          ...marathon,
          topics,
        }

        return publicMarathon

      })

      const checkParticipantExists = Effect.fn(
        "UploadFlowApiService.checkParticipantExists",
      )(function* ({ domain, reference }) {
        const existingState = yield* kv.getParticipantState(domain, reference)

        if (Option.isSome(existingState)) {
          return true
        }

        return false
      })

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
      }) {
        const executeEffect = Effect.gen(function* () {
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
                        message: `[${domain}] Marathon not found`,
                      }),
                    ),
                }),
              ),
            )


          const competitionClass = yield* Array.findFirst(
            marathon.competitionClasses,
            (c) => c.id === competitionClassId,
          ).pipe(
            Option.match({
              onSome: (competitionClass) => Effect.succeed(competitionClass),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: `[${domain}] Competition class not found`,
                  }),
                ),
            }),
          )

          yield* Array.findFirst(
            marathon.deviceGroups,
            (c) => c.id === deviceGroupId,
          ).pipe(
            Option.match({
              onSome: (deviceGroup) => Effect.succeed(deviceGroup),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: `[${domain}] Device group not found`,
                  }),
                ),
            }),
          )

          const existingParticipant =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            })

          const existingSubmissions = Option.match(existingParticipant, {
            onSome: (existing) => existing.submissions.map((s) => s.id),
            onNone: () => [] as number[],
          })

          const { encrypted, hash } = yield* Option.match(Option.fromNullishOr(phoneNumber), {
            onSome: (phoneNumber) => phoneEncryption.encrypt({ phoneNumber }),
            onNone: () => Effect.succeed<{ encrypted: null, hash: null }>({ encrypted: null, hash: null }),
          })

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
          } satisfies NewParticipant


          const participant: Participant = yield* Option.match(existingParticipant, {
            onSome: (existing) => {
              if (existing.status === "completed") {
                return Effect.fail(
                  new UploadFlowApiError({
                    message: `[${domain}|${reference}] Participant already completed upload flow`,
                  }),
                )
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
          })

          const topics = pipe(
            marathon.topics,
            Array.sort(
              Order.mapInput(Order.Number, (topic: Topic) => topic.orderIndex),
            ),
            Array.drop(competitionClass.topicStartIndex),
            Array.take(competitionClass.numberOfPhotos),
          )

          const submissionKeys = yield* Effect.forEach(
            topics,
            (topic) =>
              s3.generateSubmissionKey(domain, reference, topic.orderIndex),
            { concurrency: "unbounded" },
          )


          if (existingSubmissions.length > 0) {
            yield* db.submissionsQueries.deleteMultipleSubmissions({
              ids: existingSubmissions,
            })
          }

          yield* db.submissionsQueries.createMultipleSubmissions({
            data: topics.map((topic, i) => ({
              participantId: participant.id,
              key: submissionKeys[i]!,
              marathonId: marathon.id,
              topicId: topic.id,
              status: "initialized",
            })),
          })

          yield* kv.initializeState(domain, reference, submissionKeys)

          const presignedUrls = yield* Effect.forEach(
            submissionKeys,
            (key) => s3.getPresignedUrl(bucketName, key, "PUT"),
            { concurrency: "unbounded" },
          )

          return Array.zip(submissionKeys, presignedUrls).map(([key, url]) => ({
            key,
            url,
          }))
        })

        const channel = yield* PubSubChannel.fromString(
          `${environment}:upload-flow:${domain}-${reference}`,
        )

        return yield* runStateService.withRunStateEvents({
          taskName: "upload-initializer",
          channel,
          effect: executeEffect,
          metadata: {
            domain,
            reference,
          },
        })
      })

      const getUploadStatus = Effect.fn("UploadFlowApiService.getUploadStatus")(
        function* ({ domain, reference, orderIndexes }) {
          const participantState = yield* kv.getParticipantState(domain, reference)
          const submissionStates = yield* kv.getAllSubmissionStates(
            domain,
            reference,
            orderIndexes,
          )

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
          }
        },
      )

      const initializeByCameraUpload = Effect.fn(
        "UploadFlowApiService.initializeByCameraUpload",
      )(function* ({
        domain,
        reference,
        firstname,
        lastname,
        deviceGroupId,
        email,
        phoneNumber,
      }) {
        const executeEffect = Effect.gen(function* () {
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
                        message: `[${domain}] Marathon not found`,
                      }),
                    ),
                }),
              ),
            )

          const existingParticipant =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            })

          const existingSubmissions = Option.match(existingParticipant, {
            onSome: (existing) => existing.submissions.map((s) => s.id),
            onNone: () => [] as number[],
          })

          const competitionClassId = yield* Array.findFirst(
            marathon.competitionClasses,
            (c) => c.numberOfPhotos === 1,
          ).pipe(
            Option.match({
              onSome: (competitionClass) => Effect.succeed(competitionClass.id),
              onNone: () => Effect.fail(new UploadFlowApiError({ message: `[${domain}] Competition class not found` })),
            }),
          )

          const { encrypted, hash } = yield* Option.match(Option.fromNullishOr(phoneNumber), {
            onSome: (phoneNumber) => phoneEncryption.encrypt({ phoneNumber }),
            onNone: () => Effect.succeed<{ encrypted: null, hash: null }>({ encrypted: null, hash: null }),
          })

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
          } satisfies NewParticipant

          const participant: Participant = yield* Option.match(existingParticipant, {
            onSome: (existing) => {
              if (existing.status === "completed") {
                return Effect.fail(
                  new UploadFlowApiError({
                    message: `[${domain}|${reference}] Participant already completed upload flow`,
                  }),
                )
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
          })

          const activeTopic = yield* Array.findFirst(
            marathon.topics,
            (topic) => topic.visibility === "active",
          ).pipe(
            Option.match({
              onSome: (topic) => Effect.succeed(topic),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: `[${domain}] No active topic found for marathon`,
                  }),
                ),
            }),
          )

          const orderIndex = activeTopic.orderIndex
          const submissionKey = yield* s3.generateSubmissionKey(domain, reference, orderIndex)

          if (existingSubmissions.length > 0) {
            yield* db.submissionsQueries.deleteMultipleSubmissions({
              ids: existingSubmissions,
            })
          }

          yield* db.submissionsQueries.createMultipleSubmissions({
            data: [{
              participantId: participant.id,
              key: submissionKey,
              marathonId: marathon.id,
              topicId: activeTopic.id,
              status: "initialized",
            }],
          })

          yield* kv.initializeState(domain, reference, [submissionKey])

          const presignedUrl = yield* s3.getPresignedUrl(bucketName, submissionKey, "PUT")

          return [{
            key: submissionKey,
            url: presignedUrl,
          }]
        })

        const channel = yield* PubSubChannel.fromString(
          `${environment}:upload-flow:${domain}-${reference}`,
        )

        return yield* runStateService.withRunStateEvents({
          taskName: "by-camera-upload-initializer",
          channel,
          effect: executeEffect,
          metadata: {
            domain,
            reference,
          },
        })
      })

      const reTriggerUploadFlow = Effect.fn("UploadFlowApiService.reTriggerUploadFlow")(function* ({ domain, reference }) {
        const participantState = yield* kv.getParticipantState(domain, reference)
        if (Option.isNone(participantState)) {
          return Effect.fail(new UploadFlowApiError({ message: `[${domain}|${reference}] Participant not initialized` }))
        }
        const submissionStates = yield* kv.getAllSubmissionStates(domain, reference, [...participantState.value.orderIndexes])

        const submissionKeys = submissionStates.map((state) => state.key)



        yield* sqs.sendMessage(queueUrl, JSON.stringify({
          submissionKeys: submissionKeys,
        }))

      })

      return {
        initializeUploadFlow,
        initializeByCameraUpload,
        getPublicMarathon,
        checkParticipantExists,
        getUploadStatus,
        reTriggerUploadFlow,
      } as const
    }),


  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      Database.layer,
      S3Service.layer,
      SQSService.layer,
      UploadSessionRepository.layer,
      PubSubService.layer,
      RunStateService.layer,
      PhoneNumberEncryptionService.layer,
    ))
  )
}
