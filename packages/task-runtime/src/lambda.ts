import { LambdaHandler, type SQSEvent } from '@effect-aws/lambda'
import type { SQSBatchItemFailure, SQSBatchResponse, SQSRecord } from 'aws-lambda'
import { Effect, Layer } from 'effect'
import { RealtimeEventsService, type RealtimeEventKey } from '@blikka/realtime'
import { TaskEnvironment } from './environment'
import { makeTaskRuntimeLayer } from './layer'

export interface TaskEventTarget {
  domain: string
  reference?: string
  metadata?: { orderIndex?: number }
}

export interface SqsRealtimeTaskOptions<Input extends TaskEventTarget, R> {
  taskName: string
  spanName: string
  eventKey: RealtimeEventKey
  decodeRecord: (record: SQSRecord) => Effect.Effect<Input | ReadonlyArray<Input>, unknown, R>
  run: (input: Input) => Effect.Effect<unknown, unknown, R>
  recordConcurrency?: number
  inputConcurrency?: number
}

export interface SqsTaskOptions<Input, R> {
  taskName: string
  spanName: string
  decodeRecord: (record: SQSRecord) => Effect.Effect<Input | ReadonlyArray<Input>, unknown, R>
  run: (input: Input) => Effect.Effect<unknown, unknown, R>
  recordConcurrency?: number
  inputConcurrency?: number
}

/**
 * Runs each SQS record independently and reports per-record failures via the
 * `SQSBatchResponse` partial-batch protocol instead of failing the whole effect.
 *
 * A failing record (decode or `run` error — or an unexpected defect) is logged and its
 * `messageId` is added to `batchItemFailures`; the rest of the batch still completes. AWS then
 * redelivers ONLY the failed messages — so one poison record no longer drags its 9 batch-mates
 * through up-to-5 redeliveries to the DLQ. `catchCause` (not `catch`) is deliberate: it isolates
 * defects too, so a record that dies still fails alone instead of crashing the whole invocation.
 *
 * IMPORTANT: this only takes effect when the event source mapping has `ReportBatchItemFailures`
 * enabled (`batch: { partialResponses: true }` in `sst.config.ts`). Without it, AWS treats a
 * non-throwing invocation as full success and deletes every message — including the failed ones.
 * The two must ship together.
 */
const processRecordsWithPartialFailures = <R>(
  event: SQSEvent,
  processRecord: (record: SQSRecord) => Effect.Effect<unknown, unknown, R>,
  options: { taskName: string; recordConcurrency?: number },
) =>
  Effect.gen(function* () {
    const outcomes = yield* Effect.forEach(
      event.Records,
      (record) =>
        processRecord(record).pipe(
          Effect.as<SQSBatchItemFailure | null>(null),
          Effect.catchCause((cause) =>
            Effect.logError(`${options.taskName} record failed`, cause).pipe(
              Effect.annotateLogs({ messageId: record.messageId }),
              Effect.as<SQSBatchItemFailure | null>({ itemIdentifier: record.messageId }),
            ),
          ),
        ),
      { concurrency: options.recordConcurrency ?? 2 },
    )

    return {
      batchItemFailures: outcomes.filter(
        (outcome): outcome is SQSBatchItemFailure => outcome !== null,
      ),
    } satisfies SQSBatchResponse
  })

/** OTel span attributes for a single decoded task input; only defined fields are included. */
const targetSpanAttributes = (
  taskName: string,
  messageId: string,
  target?: TaskEventTarget,
): Record<string, string | number> => {
  const attributes: Record<string, string | number> = {
    'blikka.task': taskName,
    'messaging.message_id': messageId,
  }
  if (target?.domain !== undefined) attributes['blikka.domain'] = target.domain
  if (target?.reference !== undefined) attributes['blikka.reference'] = target.reference
  if (target?.metadata?.orderIndex !== undefined) {
    attributes['blikka.order_index'] = target.metadata.orderIndex
  }
  return attributes
}

export const makeSqsTask =
  <Input, R>(options: SqsTaskOptions<Input, R>) =>
  (event: SQSEvent) =>
    Effect.gen(function* () {
      const processRecord = Effect.fn(`${options.taskName}.processSQSRecord`)(function* (
        record: SQSRecord,
      ) {
        yield* Effect.annotateCurrentSpan(targetSpanAttributes(options.taskName, record.messageId))

        const decoded = yield* options.decodeRecord(record)
        const inputs = (Array.isArray(decoded) ? decoded : [decoded]) as ReadonlyArray<Input>

        yield* Effect.forEach(inputs, options.run, {
          concurrency: options.inputConcurrency ?? 1,
        })
      })

      return yield* processRecordsWithPartialFailures(event, processRecord, {
        taskName: options.taskName,
        recordConcurrency: options.recordConcurrency,
      })
    }).pipe(
      Effect.withSpan(options.spanName),
      Effect.tapError((error) => Effect.logError(`${options.taskName} failed`, error)),
    )

export const makeSqsRealtimeTask =
  <Input extends TaskEventTarget, R>(options: SqsRealtimeTaskOptions<Input, R>) =>
  (event: SQSEvent) =>
    Effect.gen(function* () {
      const realtimeEvents = yield* RealtimeEventsService
      const taskEnvironment = yield* TaskEnvironment

      const processRecord = Effect.fn(`${options.taskName}.processSQSRecord`)(function* (
        record: SQSRecord,
      ) {
        const decoded = yield* options.decodeRecord(record)
        const inputs = Array.isArray(decoded) ? decoded : [decoded]

        yield* Effect.forEach(
          inputs,
          (input) => {
            const workflow = options.run(input)

            return realtimeEvents
              .withEventResult(workflow, {
                eventKey: options.eventKey,
                environment: taskEnvironment.environment,
                domain: input.domain,
                reference: input.reference,
                metadata: input.metadata,
              })
              .pipe(
                Effect.withSpan(`${options.taskName}.run`, {
                  attributes: targetSpanAttributes(options.taskName, record.messageId, input),
                }),
              )
          },
          { concurrency: options.inputConcurrency ?? 1 },
        )
      })

      return yield* processRecordsWithPartialFailures(event, processRecord, {
        taskName: options.taskName,
        recordConcurrency: options.recordConcurrency,
      })
    }).pipe(
      Effect.withSpan(options.spanName),
      Effect.tapError((error) => Effect.logError(`${options.taskName} failed`, error)),
    )

export interface LambdaTaskLayerOptions<ROut, E, RIn> {
  taskName: string
  environment: string
  workflowLayer: Layer.Layer<ROut, E, RIn>
}

export const makeLambdaTaskLayer = <ROut, E, RIn>({
  taskName,
  environment,
  workflowLayer,
}: LambdaTaskLayerOptions<ROut, E, RIn>) =>
  makeTaskRuntimeLayer({ taskName, environment, workflowLayer })

export const makeLambdaHandler = LambdaHandler.make
