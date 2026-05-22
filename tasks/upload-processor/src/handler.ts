import { Effect } from 'effect'
import { Resource as SSTResource } from 'sst'
import {
  getEnvironmentFromStage,
  makeLambdaHandler,
  makeLambdaTaskLayer,
  makeSqsRealtimeTask,
  parseAndNormalizeMessage,
  parseUploadObjectKey,
} from '@blikka/task-runtime'
import {
  SubmissionProcessor,
  type ProcessSubmissionInput,
  SubmissionProcessorLayer,
} from '@blikka/uploads/submission-processor'

const TASK_NAME = 'upload-processor'
const REALTIME_EVENT = 'submission-processed'

interface SubmissionTaskInput extends ProcessSubmissionInput {
  readonly metadata: {
    readonly orderIndex: number
  }
}

const effectHandler = makeSqsRealtimeTask({
  taskName: TASK_NAME,
  spanName: 'UploadProcessor.handler',
  eventKey: REALTIME_EVENT,
  recordConcurrency: 3,
  inputConcurrency: 2,
  decodeRecord: (record) =>
    parseAndNormalizeMessage(record.body).pipe(
      Effect.flatMap((items) =>
        Effect.forEach(items, (item) =>
          parseUploadObjectKey(item.key).pipe(
            Effect.map((parsed) => ({
              ...parsed,
              key: item.key,
              metadata: { orderIndex: parsed.orderIndex },
            })),
            Effect.annotateLogs({ key: item.key }),
          ),
        ),
      ),
    ),
  run: (input: SubmissionTaskInput) =>
    Effect.gen(function* () {
      const submissionProcessor = yield* SubmissionProcessor

      yield* Effect.logInfo('Processing submission')

      yield* submissionProcessor.process(input).pipe(
        Effect.tap(() => Effect.logInfo('Submission processed')),
        Effect.tapError((error) => Effect.logError('Error processing submission', error)),
      )
    }).pipe(Effect.annotateLogs({ ...input })),
})

const serviceLayer = makeLambdaTaskLayer({
  taskName: TASK_NAME,
  environment: getEnvironmentFromStage(SSTResource.App.stage),
  workflowLayer: SubmissionProcessorLayer,
})

export const handler = makeLambdaHandler({
  handler: effectHandler,
  layer: serviceLayer,
})
