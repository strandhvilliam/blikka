import { Config, Effect, Layer } from "effect"
import { ZipWorker } from "./zip-worker"
import { UploadSessionRepository } from "@blikka/kv-store"
import { TelemetryLayer } from "@blikka/telemetry"
import { PubSubLoggerService } from "@blikka/pubsub"
import { RealtimeStateEventsService } from "@blikka/realtime"
import { InvalidArgumentsError } from "./utils"

const mainLayer = Layer.mergeAll(
  ZipWorker.layer,
  UploadSessionRepository.layer,
  RealtimeStateEventsService.layer,
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
    const domain = yield* Config.string("ARG_DOMAIN")
    const reference = yield* Config.string("ARG_REFERENCE")
    return { domain, reference }
  },
  Effect.mapError(
    (error) => new InvalidArgumentsError({ message: "Failed to parse arguments", cause: error })
  )
)

const runnable = Effect.gen(function* () {
  const handler = yield* ZipWorker
  const realtimeStateEvents = yield* RealtimeStateEventsService
  const environment = getEnvironment("development")

  const { domain, reference } = yield* parseArguments()

  return yield* Effect.gen(function* () {
    yield* Effect.logInfo("Running zip task")

    const runZipTaskEffect = handler.runZipTask(domain, reference).pipe(
      Effect.tap(() => Effect.logInfo("Zip task completed")),
      Effect.tapError((error) => Effect.logError("Error running zip task", error))
    )

    yield* realtimeStateEvents
      .withRealtimeStateEvents(runZipTaskEffect, {
        taskName: "zip-worker",
        environment,
        domain,
        reference,
      })
      .pipe(Effect.catch((error) => Effect.logError("Error running zip task", error)))
  }).pipe(Effect.annotateLogs({ domain, reference }))
}).pipe(Effect.provide(mainLayer))

Effect.runPromise(runnable)
