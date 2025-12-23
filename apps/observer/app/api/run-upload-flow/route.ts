import { PubSubLoggerService } from "@blikka/pubsub"
import { Effect, Layer, Option, Schema, Array, Data, Order, pipe, Config } from "effect"
import { Database, Topic } from "@blikka/db"
import { UploadSessionRepository } from "@blikka/kv-store"
import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { createEffectWebHandler } from "../../lib/utils"
import { S3Service } from "@blikka/s3"

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  message: string
}> {}

class BadRequestError extends Data.TaggedError("BadRequestError")<{
  message: string
}> {}

const BodySchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
  firstname: Schema.String,
  lastname: Schema.String,
  email: Schema.String,
  competitionClassId: Schema.Number,
  deviceGroupId: Schema.Number,
})

const effectHandler = Effect.gen(function* () {
  const db = yield* Database
  const uploadRepository = yield* UploadSessionRepository
  const s3 = yield* S3Service

  const body = yield* HttpServerRequest.schemaBodyJson(BodySchema)

  yield* db.participantsQueries
    .getParticipantByReference({
      reference: body.reference,
      domain: body.domain,
    })
    .pipe(
      Effect.andThen(
        Option.match({
          onNone: () => Effect.succeed(undefined),
          onSome: () => new BadRequestError({ message: "Participant already exists" }),
        })
      )
    )

  const marathon = yield* db.marathonsQueries
    .getMarathonByDomainWithOptions({
      domain: body.domain,
    })
    .pipe(
      Effect.andThen(
        Option.match({
          onSome: (marathon) => Effect.succeed(marathon),
          onNone: () => new NotFoundError({ message: "Marathon not found" }),
        })
      )
    )

  const competitionClass = yield* Array.findFirst(
    marathon.competitionClasses,
    (c) => c.id === body.competitionClassId
  ).pipe(
    Option.match({
      onSome: (competitionClass) => Effect.succeed(competitionClass),
      onNone: () => Effect.fail(new NotFoundError({ message: "Competition class not found" })),
    })
  )

  console.log({ competitionClass })

  const topics = pipe(
    marathon.topics,
    Array.sort(Order.mapInput(Order.number, (topic: Topic) => topic.orderIndex)),
    Array.drop(competitionClass.topicStartIndex)
  )

  const participant = yield* db.participantsQueries.createParticipant({
    data: {
      reference: body.reference,
      domain: body.domain,
      competitionClassId: body.competitionClassId,
      deviceGroupId: body.deviceGroupId,
      marathonId: marathon.id,
      firstname: body.firstname,
      lastname: body.lastname,
      email: body.email,
    },
  })

  const submissionKeys = yield* Effect.forEach(topics, (topic) =>
    s3.generateSubmissionKey(body.domain, body.reference, topic.orderIndex)
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

  yield* uploadRepository.initializeState(body.domain, body.reference, submissionKeys)

  const bucketName = yield* Config.string("DEV_SUBMISSIONS_BUCKET_NAME")
  const presignedUrls = yield* Effect.forEach(submissionKeys, (key) =>
    s3.getPresignedUrl(bucketName, key, "PUT")
  )

  const presignedUrlsWithKeys = submissionKeys.map((key, index) => ({
    key,
    url: presignedUrls[index],
  }))

  return yield* HttpServerResponse.json({
    participantId: participant.id,
    presignedUrls: presignedUrlsWithKeys,
  })
}).pipe(
  Effect.catchTags({
    NotFoundError: (error) => HttpServerResponse.empty({ status: 404, statusText: error.message }),
    BadRequestError: (error) =>
      HttpServerResponse.empty({ status: 400, statusText: error.message }),
  }),
  Effect.catchAll((error) =>
    Effect.logError(error).pipe(
      Effect.andThen(() =>
        HttpServerResponse.empty({
          status: 500,
          statusText:
            error?._tag === "HttpBodyError"
              ? "Internal Server Error"
              : (error?.message ?? "Internal Server Error"),
        })
      )
    )
  ),
  Effect.catchAllDefect((error) =>
    Effect.logError("defect error", error).pipe(
      Effect.andThen(() =>
        HttpServerResponse.empty({ status: 500, statusText: "Internal Server Error" })
      )
    )
  )
)

const mainLive = Layer.mergeAll(
  PubSubLoggerService.withTaskName("upload-processor"),
  Database.Default,
  UploadSessionRepository.Default,
  S3Service.Default
)
const handler = await createEffectWebHandler(mainLive, effectHandler)

export const POST = handler
