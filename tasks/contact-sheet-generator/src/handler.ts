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
  // One sheet at a time. A no-op today (the ESM delivers batch.size 1), but it keeps peak memory
  // at one in-flight sheet if the batch size is ever raised. Concurrent sheets buy little anyway:
  // 4096 MB is ~2.4 vCPU and the build is CPU-bound, so two sheets mostly contend rather than
  // overlap, while doubling the resident originals.
  recordConcurrency: 1,
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
