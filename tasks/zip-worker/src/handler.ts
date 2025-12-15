import { task } from "sst/aws/task"
import { Data, Effect, Layer, Option } from "effect"
import { LambdaHandler, SQSEvent } from "@effect-aws/lambda"
import { Resource as SSTResource } from "sst"
import { UploadKVRepository } from "@blikka/kv-store"
import { parseFinalizedEvent } from "./utils"
import { ZipWorker } from "./zip-worker"
import { TelemetryLayer } from "@blikka/telemetry"
import { FinalizedEventSchema, EventBusDetailTypes, parseBusEvent } from "@blikka/bus"

class UnableToRunZipHandlerTaskError extends Data.TaggedError("UnableToRunZipHandlerTaskError")<{
  cause?: unknown
}> {}

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const kvStore = yield* UploadKVRepository
    yield* Effect.forEach(event.Records, (record) =>
      Effect.gen(function* () {
        const { domain, reference } = yield* parseBusEvent<
          typeof EventBusDetailTypes.Finalized,
          typeof FinalizedEventSchema.Type
        >(record.body, FinalizedEventSchema)

        const participantStateOpt = yield* kvStore.getParticipantState(domain, reference)

        if (Option.isSome(participantStateOpt) && !!participantStateOpt.value.zipKey) {
          yield* Effect.log("Participant already zipped, skipping")
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
  UploadKVRepository.Default,
  TelemetryLayer("blikka-dev-zip-worker-handler")
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
