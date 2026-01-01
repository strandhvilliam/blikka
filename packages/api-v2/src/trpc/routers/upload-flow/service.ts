import { Config, Effect, Option, Array, Order, pipe } from "effect"
import { type NewParticipant, type Topic, Database } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import { UploadSessionRepository } from "@blikka/kv-store"
import { PubSubChannel, PubSubService, RunStateService } from "@blikka/pubsub"
import { UploadFlowError } from "./schemas"

export class UploadFlowService extends Effect.Service<UploadFlowService>()(
  "@blikka/api-v2/upload-flow-service",
  {
    accessors: true,
    dependencies: [
      Database.Default,
      S3Service.Default,
      UploadSessionRepository.Default,
      PubSubService.Default,
      RunStateService.Default,
    ],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service
      const kv = yield* UploadSessionRepository
      const runStateService = yield* RunStateService
      const bucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
      const environment = yield* Config.string("NODE_ENV").pipe(
        Config.map((env) => (env === "production" ? "prod" : "dev"))
      )

      const getPublicMarathon = Effect.fn("UploadFlowService.getPublicMarathon")(function* ({
        domain,
      }) {
        return yield* db.marathonsQueries
          .getMarathonByDomainWithOptions({
            domain,
          })
          .pipe(
            Effect.andThen(
              Option.match({
                onSome: (marathon) => Effect.succeed(marathon),
                onNone: () =>
                  new UploadFlowError({
                    message: "Marathon not found",
                  }),
              })
            )
          )
      })

      const initializeUploadFlow = Effect.fn("UploadFlowService.initializeUploadFlow")(function* ({
        domain,
        reference,
        firstname,
        lastname,
        email,
        competitionClassId,
        deviceGroupId,
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
                      new UploadFlowError({
                        message: "Marathon not found",
                      })
                    ),
                })
              )
            )

          const competitionClass = yield* Array.findFirst(
            marathon.competitionClasses,
            (c) => c.id === competitionClassId
          ).pipe(
            Option.match({
              onSome: (competitionClass) => Effect.succeed(competitionClass),
              onNone: () =>
                Effect.fail(
                  new UploadFlowError({
                    message: "Competition class not found",
                  })
                ),
            })
          )

          yield* Array.findFirst(marathon.deviceGroups, (c) => c.id === deviceGroupId).pipe(
            Option.match({
              onSome: (deviceGroup) => Effect.succeed(deviceGroup),
              onNone: () =>
                Effect.fail(
                  new UploadFlowError({
                    message: "Device group not found",
                  })
                ),
            })
          )

          const existingParticipant = yield* db.participantsQueries.getParticipantByReference({
            reference,
            domain,
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
          } satisfies NewParticipant

          const participant = yield* Option.match(existingParticipant, {
            onSome: (existing) => {
              if (existing.status === "completed") {
                return Effect.fail(
                  new UploadFlowError({
                    message: "Participant already completed the marathon",
                  })
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
            Array.sort(Order.mapInput(Order.number, (topic: Topic) => topic.orderIndex)),
            Array.drop(competitionClass.topicStartIndex),
            Array.take(competitionClass.numberOfPhotos)
          )

          const submissionKeys = yield* Effect.forEach(
            topics,
            (topic) => s3.generateSubmissionKey(domain, reference, topic.orderIndex),
            { concurrency: "unbounded" }
          )

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
            { concurrency: "unbounded" }
          )

          return Array.zip(submissionKeys, presignedUrls).map(([key, url]) => ({ key, url }))
        })
        const channel = yield* PubSubChannel.fromString(
          `${environment}:upload-flow:${domain}-${reference}`
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

      return {
        initializeUploadFlow,
        getPublicMarathon,
      } as const
    }),
  }
) {}
