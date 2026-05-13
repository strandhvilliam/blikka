import { LambdaHandler, type SQSEvent } from "@effect-aws/lambda";
import type { SQSRecord } from "aws-lambda";
import { Effect, Layer } from "effect";
import { PubSubLoggerService } from "@blikka/pubsub";
import { RealtimeEventsService, type RealtimeEventKey } from "@blikka/realtime";
import { TelemetryLayer } from "@blikka/telemetry";
import { TaskEnvironment } from "./environment";

export interface TaskEventTarget {
  domain: string;
  reference?: string;
  metadata?: { orderIndex?: number };
}

export interface SqsRealtimeTaskOptions<Input extends TaskEventTarget, R> {
  taskName: string;
  spanName: string;
  eventKey: RealtimeEventKey;
  decodeRecord: (record: SQSRecord) => Effect.Effect<Input, unknown, R>;
  run: (input: Input) => Effect.Effect<unknown, unknown, R>;
  recordConcurrency?: number;
}

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
          const input = yield* options.decodeRecord(record);
          const workflow = options.run(input);

          yield* realtimeEvents.withEventResult(workflow, {
            eventKey: options.eventKey,
            environment: taskEnvironment.environment,
            domain: input.domain,
            reference: input.reference,
            metadata: input.metadata,
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

export interface LambdaTaskLayerOptions {
  taskName: string;
  environment: string;
  workflowLayer: Layer.Layer<unknown, unknown, unknown>;
}

export const makeLambdaTaskLayer = ({
  taskName,
  environment,
  workflowLayer,
}: LambdaTaskLayerOptions) =>
  Layer.mergeAll(
    workflowLayer,
    RealtimeEventsService.layer,
    PubSubLoggerService.withTaskName(taskName),
    TelemetryLayer(`blikka-${environment}-${taskName}`),
    Layer.effect(TaskEnvironment, TaskEnvironment.make),
  );

export const makeLambdaHandler = LambdaHandler.make;
