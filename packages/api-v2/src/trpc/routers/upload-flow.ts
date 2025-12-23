import { Data, Effect, Option, Schema, Array, pipe, Order, Config } from "effect"
import { createTRPCRouter, publicProcedure } from "../root"
import { trpcEffect } from "../utils"
import { S3Service } from "@blikka/s3"
import { Database, type NewParticipant, type Topic } from "@blikka/db"
import { UploadSessionRepository } from "@blikka/kv-store"

export class InitializeUploadFlowError extends Data.TaggedError("InitializeUploadFlowError")<{
  message?: string
  cause?: unknown
}> {}

export const uploadFlowRouter = createTRPCRouter({
  getPublicMarathon: publicProcedure
    .input(Schema.standardSchemaV1(Schema.Struct({ domain: Schema.String })))
    .query(
      trpcEffect(
        Effect.fn("UploadFlowRouter.getPublicMarathon")(function* ({ input }) {
          //TODO: cache this in redis if marathon has started
          const db = yield* Database
          return yield* db.marathonsQueries
            .getMarathonByDomainWithOptions({
              domain: input.domain,
            })
            .pipe(
              Effect.andThen(
                Option.match({
                  onSome: (marathon) => Effect.succeed(marathon),
                  onNone: () => new InitializeUploadFlowError({ message: "Marathon not found" }),
                })
              )
            )
        })
      )
    ),
  initializeUploadFlow: publicProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({
          domain: Schema.String,
          reference: Schema.String,
          firstname: Schema.String,
          lastname: Schema.String,
          email: Schema.String,
          competitionClassId: Schema.Number,
          deviceGroupId: Schema.Number,
        })
      )
    )
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.getUploadFlow")(function* ({ input }) {
          const s3 = yield* S3Service
          const db = yield* Database
          const kv = yield* UploadSessionRepository
          const bucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")

          const marathon = yield* db.marathonsQueries
            .getMarathonByDomainWithOptions({
              domain: input.domain,
            })
            .pipe(
              Effect.andThen(
                Option.match({
                  onSome: (marathon) => Effect.succeed(marathon),
                  onNone: () =>
                    new InitializeUploadFlowError({
                      message: "Marathon not found",
                    }),
                })
              )
            )

          const competitionClass = yield* Array.findFirst(
            marathon.competitionClasses,
            (c) => c.id === input.competitionClassId
          ).pipe(
            Option.match({
              onSome: (competitionClass) => Effect.succeed(competitionClass),
              onNone: () =>
                new InitializeUploadFlowError({ message: "Competition class not found" }),
            })
          )

          yield* Array.findFirst(marathon.deviceGroups, (c) => c.id === input.deviceGroupId).pipe(
            Option.match({
              onSome: (deviceGroup) => Effect.succeed(deviceGroup),
              onNone: () => new InitializeUploadFlowError({ message: "Device group not found" }),
            })
          )

          const existingParticipant = yield* db.participantsQueries.getParticipantByReference({
            reference: input.reference,
            domain: input.domain,
          })

          const participantData = {
            reference: input.reference,
            domain: input.domain,
            competitionClassId: input.competitionClassId,
            deviceGroupId: input.deviceGroupId,
            marathonId: marathon.id,
            firstname: input.firstname,
            lastname: input.lastname,
            email: input.email,
            status: "initialized",
          } satisfies NewParticipant

          const participant = yield* Option.match(existingParticipant, {
            onSome: (existing) => {
              if (existing.status === "completed") {
                return Effect.fail(
                  new InitializeUploadFlowError({
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
            Array.drop(competitionClass.topicStartIndex)
          )

          const submissionKeys = yield* Effect.forEach(
            topics,
            (topic) => s3.generateSubmissionKey(input.domain, input.reference, topic.orderIndex),
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

          yield* kv.initializeState(input.domain, input.reference, submissionKeys)

          const presignedUrls = yield* Effect.forEach(
            submissionKeys,
            (key) => s3.getPresignedUrl(bucketName, key, "PUT"),
            { concurrency: "unbounded" }
          )

          return Array.zip(submissionKeys, presignedUrls).map(([key, url]) => ({ key, url }))
        })
      )
    ),
})
