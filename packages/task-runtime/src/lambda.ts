import { LambdaHandler, type SQSEvent } from "@effect-aws/lambda";
import type { SQSRecord } from "aws-lambda";
import { Effect, Layer } from "effect";
import { RealtimeEventsService, type RealtimeEventKey } from "@blikka/realtime";
import { TaskEnvironment } from "./environment";
import { makeTaskRuntimeLayer } from "./layer";

export interface TaskEventTarget {
  domain: string;
  reference?: string;
  metadata?: { orderIndex?: number };
}

export interface SqsRealtimeTaskOptions<Input extends TaskEventTarget, R> {
  taskName: string;
  spanName: string;
  eventKey: RealtimeEventKey;
  decodeRecord: (
    record: SQSRecord,
  ) => Effect.Effect<Input | ReadonlyArray<Input>, unknown, R>;
  run: (input: Input) => Effect.Effect<unknown, unknown, R>;
  recordConcurrency?: number;
  inputConcurrency?: number;
}

export interface SqsTaskOptions<Input, R> {
  taskName: string;
  spanName: string;
  decodeRecord: (
    record: SQSRecord,
  ) => Effect.Effect<Input | ReadonlyArray<Input>, unknown, R>;
  run: (input: Input) => Effect.Effect<unknown, unknown, R>;
  recordConcurrency?: number;
  inputConcurrency?: number;
}

export const makeSqsTask =
  <Input, R>(options: SqsTaskOptions<Input, R>) =>
  (event: SQSEvent) =>
    Effect.gen(function* () {
      const processRecord = Effect.fn(`${options.taskName}.processSQSRecord`)(
        function* (record: SQSRecord) {
          const decoded = yield* options.decodeRecord(record);
          const inputs = (
            Array.isArray(decoded) ? decoded : [decoded]
          ) as ReadonlyArray<Input>;

          yield* Effect.forEach(inputs, options.run, {
            concurrency: options.inputConcurrency ?? 1,
          });
        },
      );

      yield* Effect.forEach(event.Records, processRecord, {
        concurrency: options.recordConcurrency ?? 2,
      });
    }).pipe(
      Effect.withSpan(options.spanName),
      Effect.tapError((error) =>
        Effect.logError(`${options.taskName} failed`, error),
      ),
    );

export const makeSqsRealtimeTask =
  <Input extends TaskEventTarget, R>(
    options: SqsRealtimeTaskOptions<Input, R>,
  ) =>
  (event: SQSEvent) =>
    Effect.gen(function* () {
      const realtimeEvents = yield* RealtimeEventsService;
      const taskEnvironment = yield* TaskEnvironment;

      const processRecord = Effect.fn(`${options.taskName}.processSQSRecord`)(
        function* (record: SQSRecord) {
          const decoded = yield* options.decodeRecord(record);
          const inputs = Array.isArray(decoded) ? decoded : [decoded];

          yield* Effect.forEach(
            inputs,
            (input) => {
              const workflow = options.run(input);

              return realtimeEvents.withEventResult(workflow, {
                eventKey: options.eventKey,
                environment: taskEnvironment.environment,
                domain: input.domain,
                reference: input.reference,
                metadata: input.metadata,
              });
            },
            { concurrency: options.inputConcurrency ?? 1 },
          );
        },
      );

      yield* Effect.forEach(event.Records, processRecord, {
        concurrency: options.recordConcurrency ?? 2,
      });
    }).pipe(
      Effect.withSpan(options.spanName),
      Effect.tapError((error) =>
        Effect.logError(`${options.taskName} failed`, error),
      ),
    );

export interface LambdaTaskLayerOptions<ROut, E, RIn> {
  taskName: string;
  environment: string;
  workflowLayer: Layer.Layer<ROut, E, RIn>;
}

export const makeLambdaTaskLayer = <ROut, E, RIn>({
  taskName,
  environment,
  workflowLayer,
}: LambdaTaskLayerOptions<ROut, E, RIn>) =>
  makeTaskRuntimeLayer({ taskName, environment, workflowLayer });

export const makeLambdaHandler = LambdaHandler.make;
