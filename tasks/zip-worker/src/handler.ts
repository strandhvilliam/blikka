import { task } from "sst/aws/task"
import { Effect, Layer, Option, Schema } from "effect"
import { LambdaHandler, type SQSEvent } from "@effect-aws/lambda"
import { Resource as SSTResource } from "sst"
import { UploadSessionRepository } from "@blikka/kv-store"
import { TelemetryLayer } from "@blikka/telemetry"
import { FinalizedEventSchema, parseBusEvent } from "@blikka/bus"

class UnableToRunZipHandlerTaskError extends Schema.TaggedErrorClass<UnableToRunZipHandlerTaskError>()("UnableToRunZipHandlerTaskError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const kvStore = yield* UploadSessionRepository
    yield* Effect.forEach(event.Records, (record) =>
      Effect.gen(function* () {
        const { domain, reference } = yield* parseBusEvent(record.body, FinalizedEventSchema)

        return yield* Effect.gen(function* () {
          const participantStateOpt = yield* kvStore.getParticipantState(domain, reference)

          if (Option.isNone(participantStateOpt)) {
            yield* Effect.logWarning("Participant state not found, skipping")
            return
          }

          const participantState = participantStateOpt.value

          if (participantState.zipKey) {
            yield* Effect.logWarning("Participant already zipped, skipping")
            return
          }

          if (!participantState.finalized) {
            yield* Effect.logWarning("Participant not finalized, skipping")
            return
          }

          if (participantState.orderIndexes.length === 1) {
            yield* Effect.logWarning("Participant has only one submission, skipping")
            return
          }

          yield* Effect.tryPromise({
            try: () =>
              task.run(SSTResource.ZipHandlerTask, {
                ARG_DOMAIN: domain,
                ARG_REFERENCE: reference,
              }),
            catch: (error) => new UnableToRunZipHandlerTaskError({ message: "Failed to run zip handler task", cause: error }),
          })
        }).pipe(Effect.annotateLogs({ domain, reference }))
      })
    )
  }).pipe(Effect.withSpan("ZipWorker.handler"), Effect.catch((error) => Effect.logError("Error running zip worker", error)))

const serviceLayer = Layer.mergeAll(
  UploadSessionRepository.layer,
  TelemetryLayer("blikka-dev-zip-worker-handler")
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
