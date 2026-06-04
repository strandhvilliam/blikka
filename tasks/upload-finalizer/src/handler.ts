import { Effect } from 'effect'
import { FinalizedEventSchema } from '@blikka/aws'
import { RealtimeEventsService } from '@blikka/realtime'
import { Resource as SSTResource } from 'sst'
import {
  getEnvironmentFromStage,
  makeLambdaHandler,
  makeLambdaTaskLayer,
  makeSqsRealtimeTask,
  parseBusEvent,
  TaskEnvironment,
} from '@blikka/task-runtime'
import { UploadFinalizer, UploadFinalizerLayer } from '@blikka/uploads/participant-finalizer'

const TASK_NAME = 'upload-finalizer'
const REALTIME_EVENT = 'participant-finalized'

const effectHandler = makeSqsRealtimeTask({
  taskName: TASK_NAME,
  spanName: 'UploadFinalizer.handler',
  eventKey: REALTIME_EVENT,
  recordConcurrency: 2,
  decodeRecord: (record) => parseBusEvent(record.body, FinalizedEventSchema),
  run: (input) =>
    Effect.gen(function* () {
      const uploadFinalizer = yield* UploadFinalizer
      const realtimeEvents = yield* RealtimeEventsService
      const taskEnvironment = yield* TaskEnvironment

      yield* Effect.logInfo('Finalizing participant')

      const transition = yield* uploadFinalizer.finalize(input).pipe(
        Effect.tap(() => Effect.logInfo('Participant finalized')),
        Effect.tapError((error) => Effect.logError('Error finalizing participant', error)),
      )

      // Auto-verify in flagged mode when validation already passed; see @blikka/uploads/flagged-verification-flow.
      if (transition.changedToVerified) {
        yield* realtimeEvents
          .emitEventResult({
            environment: taskEnvironment.environment,
            domain: input.domain,
            reference: input.reference,
            eventKey: 'participant-verified',
            outcome: 'success',
            timestamp: Date.now(),
            channels: 'participant',
          })
          .pipe(
            Effect.catch((error) =>
              Effect.logError('Error emitting auto-verification realtime event', error),
            ),
          )
      }
    }).pipe(Effect.annotateLogs({ ...input })),
})

const serviceLayer = makeLambdaTaskLayer({
  taskName: TASK_NAME,
  environment: getEnvironmentFromStage(SSTResource.App.stage),
  workflowLayer: UploadFinalizerLayer,
})

export const handler = makeLambdaHandler({
  handler: effectHandler,
  layer: serviceLayer,
})
