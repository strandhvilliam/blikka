import { EcsTaskRunnerService, EcsTaskRunnerServiceLayer } from '@blikka/aws'
import { Config, Context, Effect, Layer, Schema } from 'effect'

export class UnableToRunZipDownloaderTaskError extends Schema.TaggedErrorClass<UnableToRunZipDownloaderTaskError>()(
  '@blikka/api/UnableToRunZipDownloaderTaskError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ZipDownloaderTrigger extends Context.Service<
  ZipDownloaderTrigger,
  {
    readonly triggerJob: (
      jobId: string,
    ) => Effect.Effect<void, UnableToRunZipDownloaderTaskError | Config.ConfigError, never>
  }
>()('@blikka/api/ZipDownloaderTrigger') {}

const makeZipDownloaderTrigger = Effect.gen(function* () {
  const ecsTaskRunner = yield* EcsTaskRunnerService

  const triggerJob: ZipDownloaderTrigger['Service']['triggerJob'] = (jobId) =>
    Effect.gen(function* () {
      const cluster = yield* Config.string('AWS_CLUSTER')
      const subnetsRaw = yield* Config.string('AWS_SUBNETS')
      const taskDefinition = yield* Config.string('ZIP_DOWNLOADER_TASK_DEFINITION')
      const containerName = yield* Config.string('ZIP_DOWNLOADER_CONTAINER_NAME').pipe(
        Config.withDefault('ZipDownloaderTask'),
      )

      const subnets = subnetsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      yield* Effect.logInfo({
        message: 'Starting zip downloader via ECS',
        jobId,
        cluster,
        taskDefinition,
      })

      yield* ecsTaskRunner
        .runFargateTask({
          cluster,
          taskDefinition,
          subnets,
          containerName,
          environment: { JOB_ID: jobId },
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new UnableToRunZipDownloaderTaskError({
                message: 'Failed to trigger zip downloader task',
                cause: error,
              }),
          ),
        )
    }).pipe(
      Effect.tapError((error) =>
        Effect.logError({
          message: 'Failed to start zip downloader job',
          jobId,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    )

  return ZipDownloaderTrigger.of({ triggerJob })
})

export const ZipDownloaderTriggerLayerNoDeps = Layer.effect(
  ZipDownloaderTrigger,
  makeZipDownloaderTrigger,
)

export const ZipDownloaderTriggerLayer = ZipDownloaderTriggerLayerNoDeps.pipe(
  Layer.provide(EcsTaskRunnerServiceLayer),
)
