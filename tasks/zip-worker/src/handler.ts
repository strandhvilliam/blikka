import { task } from "sst/aws/task"
import { Data, Effect, Layer, Option } from "effect"
import { LambdaHandler, SQSEvent } from "@effect-aws/lambda"
import { Resource as SSTResource } from "sst"
import { UploadSessionRepository } from "@blikka/kv-store"
import { parseFinalizedEvent } from "./utils"
import { ZipWorker } from "./zip-worker"
import { TelemetryLayer } from "@blikka/telemetry"
import { FinalizedEventSchema, EventBusDetailTypes, parseBusEvent } from "@blikka/bus"

class UnableToRunZipHandlerTaskError extends Data.TaggedError("UnableToRunZipHandlerTaskError")<{
  cause?: unknown
}> {
}

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const kvStore = yield* UploadSessionRepository
    yield* Effect.forEach(event.Records, (record) =>
      Effect.gen(function* () {
        const { domain, reference } = yield* parseBusEvent<
          typeof EventBusDetailTypes.Finalized,
          typeof FinalizedEventSchema.Type
        >(record.body, FinalizedEventSchema)

        const participantStateOpt = yield* kvStore.getParticipantState(domain, reference)

        if (Option.isNone(participantStateOpt)) {
          yield* Effect.logWarning(`[${reference}|${domain}] Participant state not found, skipping`)
          return
        }

        const participantState = participantStateOpt.value

        if (!!participantState.zipKey) {
          yield* Effect.logWarning(`[${reference}|${domain}] Participant already zipped, skipping`)
          return
        }

        if (!participantState.finalized) {
          yield* Effect.logWarning(`[${reference}|${domain}] Participant not finalized, skipping`)
          return
        }

        if (participantState.orderIndexes.length === 1) {
          yield* Effect.logWarning(`[${reference}|${domain}] Participant has only one submission, skipping`)
          return
        }

        yield* Effect.tryPromise({
          try: () =>
            task.run(SSTResource.ZipHandlerTask, {
              ARG_DOMAIN: domain,
              ARG_REFERENCE: reference,
            }),
          catch: (error) => new UnableToRunZipHandlerTaskError({ cause: error }),
        })
      })
    )
  }).pipe(Effect.withSpan("ZipWorker.handler"), Effect.catchAll(Effect.logError))

const serviceLayer = Layer.mergeAll(
  ZipWorker.Default,
  UploadSessionRepository.Default,
  TelemetryLayer("blikka-dev-zip-worker-handler")
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
