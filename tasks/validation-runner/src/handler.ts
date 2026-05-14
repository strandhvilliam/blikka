import { Effect, Layer } from "effect"
import { Database } from "@blikka/db"
import { S3Service, FinalizedEventSchema, parseBusEvent } from "@blikka/aws"
import { ExifKVRepository, UploadSessionRepository } from "@blikka/kv-store"
import { ValidationEngine } from "@blikka/validation"
import { Resource as SSTResource } from "sst"
import {
  getEnvironmentFromStage,
  makeLambdaHandler,
  makeLambdaTaskLayer,
  makeSqsRealtimeTask,
} from "@blikka/task-runtime"
import { UploadsConfig, ValidationRunner, ValidationRunnerLayer } from "@blikka/uploads"

const TASK_NAME = "validation-runner"
const REALTIME_EVENT = "participant-validated"

const effectHandler = makeSqsRealtimeTask({
  taskName: TASK_NAME,
  spanName: "ValidationRunner.handler",
  eventKey: REALTIME_EVENT,
  recordConcurrency: 2,
  decodeRecord: (record) => parseBusEvent(record.body, FinalizedEventSchema),
  run: (input) =>
    Effect.gen(function* () {
      const validationRunner = yield* ValidationRunner

      yield* Effect.logInfo("Executing validation")

      yield* validationRunner.execute(input).pipe(
        Effect.tap(() => Effect.logInfo("Validation executed")),
        Effect.tapError((error) => Effect.logError("Error executing validation", error)),
      )
    }).pipe(Effect.annotateLogs({ ...input })),
})

const serviceLayer = makeLambdaTaskLayer({
  taskName: TASK_NAME,
  environment: getEnvironmentFromStage(SSTResource.App.stage),
  workflowLayer: ValidationRunnerLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Database.layer,
        S3Service.layer,
        UploadSessionRepository.layer,
        ExifKVRepository.layer,
        ValidationEngine.layer,
        UploadsConfig.layer,
      ),
    ),
  ),
})

export const handler = makeLambdaHandler({
  handler: effectHandler,
  layer: serviceLayer,
})
