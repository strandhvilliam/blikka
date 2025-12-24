import { Effect, Layer, Schema } from "effect"
import { ZipWorker } from "./zip-worker"
import { UploadSessionRepository } from "@blikka/kv-store"
import { TelemetryLayer } from "@blikka/telemetry"
import { PubSubChannel, PubSubLoggerService, RunStateService } from "@blikka/pubsub"
import { Resource as SSTResource } from "sst"
import { InvalidArgumentsError } from "./utils"
import { BunRuntime } from "@effect/platform-bun"

const mainLayer = Layer.mergeAll(
  ZipWorker.Default,
  UploadSessionRepository.Default,
  RunStateService.Default,
  PubSubLoggerService.withTaskName("zip-worker"),
  TelemetryLayer("blikka-dev-zip-worker")
)

const getEnvironment = (stage: string): "prod" | "dev" | "staging" => {
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

const parseArguments = Effect.fn("ZipWorker.parseArguments")(
  function* () {
    const domain = yield* Schema.Config("ARG_DOMAIN", Schema.String)
    const reference = yield* Schema.Config("ARG_REFERENCE", Schema.String)
    return { domain, reference }
  },
  Effect.mapError((error) => new InvalidArgumentsError({ cause: error }))
)

const runnable = Effect.gen(function* () {
  const handler = yield* ZipWorker
  const runStateService = yield* RunStateService
  const environment = getEnvironment("development")

  const { domain, reference } = yield* parseArguments()

  const channel = yield* PubSubChannel.fromString(
    `${environment}:upload-flow:${domain}-${reference}`
  )

  yield* Effect.logInfo(`[${reference}|${domain}] Running zip task`)

  const runZipTaskEffect = handler.runZipTask(domain, reference).pipe(
    Effect.tap(() => Effect.logInfo(`[${reference}|${domain}] Zip task completed`)),
    Effect.tapError((error) =>
      Effect.logError(`[${reference}|${domain}] Error running zip task`, error.message)
    )
  )

  yield* runStateService
    .withRunStateEvents({
      taskName: "zip-worker",
      channel,
      effect: runZipTaskEffect,
      metadata: {
        domain,
        reference,
      },
    })
    .pipe(Effect.catchAll((error) => Effect.logError("Error running zip task", error.message)))
}).pipe(Effect.provide(mainLayer))

Effect.runPromise(runnable)
