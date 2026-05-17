import { task } from 'sst/aws/task'
import { Effect, Layer, Option, Schema } from 'effect'
import { Resource as SSTResource } from 'sst'
import {
  isCurrentUploadSession,
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
} from '@blikka/kv-store'
import { TelemetryLayer } from '@blikka/telemetry'
import { FinalizedEventSchema } from '@blikka/aws'
import {
  getEnvironmentFromStage,
  makeLambdaHandler,
  makeSqsTask,
  parseBusEvent,
} from '@blikka/task-runtime'

const TASK_NAME = 'zip-worker-handler'

class UnableToRunZipHandlerTaskError extends Schema.TaggedErrorClass<UnableToRunZipHandlerTaskError>()(
  'UnableToRunZipHandlerTaskError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const effectHandler = makeSqsTask({
  taskName: TASK_NAME,
  spanName: 'ZipWorker.handler',
  decodeRecord: (record) => parseBusEvent(record.body, FinalizedEventSchema),
  run: ({ domain, reference, uploadSessionId }) =>
    Effect.gen(function* () {
      const kvStore = yield* UploadSessionRepository
      const participantStateOpt = yield* kvStore.getParticipantState(domain, reference)

      if (Option.isNone(participantStateOpt)) {
        yield* Effect.logWarning('Participant state not found, skipping')
        return
      }

      const participantState = participantStateOpt.value

      if (participantState.zipKey) {
        yield* Effect.logWarning('Participant already zipped, skipping')
        return
      }

      if (!participantState.finalized) {
        yield* Effect.logWarning('Participant not finalized, skipping')
        return
      }

      if (participantState.orderIndexes.length === 1) {
        yield* Effect.logWarning('Participant has only one submission, skipping')
        return
      }

      if (participantState.uploadSessionId !== uploadSessionId) {
        yield* Effect.logWarning('Dropping zip event for non-current upload session', {
          uploadSessionId,
        })
        return
      }

      yield* Effect.tryPromise({
        try: () =>
          task.run(SSTResource.ZipHandlerTask, {
            ARG_DOMAIN: domain,
            ARG_REFERENCE: reference,
          }),
        catch: (error) =>
          new UnableToRunZipHandlerTaskError({
            message: 'Failed to run zip handler task',
            cause: error,
          }),
      })
    }).pipe(Effect.annotateLogs({ domain, reference })),
})

const serviceLayer = Layer.mergeAll(
  UploadSessionRepositoryLayer,
  TelemetryLayer(`blikka-${getEnvironmentFromStage(SSTResource.App.stage)}-${TASK_NAME}`),
)

export const handler = makeLambdaHandler({
  handler: effectHandler,
  layer: serviceLayer,
})
