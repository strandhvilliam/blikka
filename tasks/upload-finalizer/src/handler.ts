import { Effect } from 'effect'
import { FinalizedEventSchema } from '@blikka/aws'
import { Resource as SSTResource } from 'sst'
import {
  getEnvironmentFromStage,
  makeLambdaHandler,
  makeLambdaTaskLayer,
  makeSqsRealtimeTask,
  parseBusEvent,
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

      yield* Effect.logInfo('Finalizing participant')

      yield* uploadFinalizer.finalize(input).pipe(
        Effect.tap(() => Effect.logInfo('Participant finalized')),
        Effect.tapError((error) => Effect.logError('Error finalizing participant', error)),
      )
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
