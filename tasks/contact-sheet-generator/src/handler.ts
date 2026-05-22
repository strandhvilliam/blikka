import { Effect, Layer } from 'effect'
import { S3Service, FinalizedEventSchema } from '@blikka/aws'
import { UploadSessionRepository } from '@blikka/kv-store'
import { ContactSheetBuilder } from '@blikka/image-manipulation'
import { Resource as SSTResource } from 'sst'
import {
  getEnvironmentFromStage,
  makeLambdaHandler,
  makeLambdaTaskLayer,
  makeSqsRealtimeTask,
  parseBusEvent,
} from '@blikka/task-runtime'
import {
  ContactSheetGenerator,
  ContactSheetGeneratorLayer,
} from '@blikka/uploads/contact-sheet-generator'

const TASK_NAME = 'contact-sheet-generator'
const REALTIME_EVENT = 'contact-sheet-generated'

const effectHandler = makeSqsRealtimeTask({
  taskName: TASK_NAME,
  spanName: 'ContactSheetGenerator.handler',
  eventKey: REALTIME_EVENT,
  recordConcurrency: 2,
  decodeRecord: (record) => parseBusEvent(record.body, FinalizedEventSchema),
  run: (input) =>
    Effect.gen(function* () {
      const contactSheetGenerator = yield* ContactSheetGenerator

      yield* Effect.logInfo('Generating contact sheet')

      yield* contactSheetGenerator.generate(input).pipe(
        Effect.tap(() => Effect.logInfo('Contact sheet generated')),
        Effect.tapError((error) => Effect.logError('Error generating contact sheet', error)),
      )
    }).pipe(Effect.annotateLogs({ ...input })),
})

const serviceLayer = makeLambdaTaskLayer({
  taskName: TASK_NAME,
  environment: getEnvironmentFromStage(SSTResource.App.stage),
  workflowLayer: ContactSheetGeneratorLayer,
})

export const handler = makeLambdaHandler({
  handler: effectHandler,
  layer: serviceLayer,
})
