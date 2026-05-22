import { PubSubLoggerService } from '@blikka/pubsub'
import { RealtimeEventsService, RealtimeEventsServiceLayer } from '@blikka/realtime'
import { TelemetryLayer } from '@blikka/telemetry'
import { Layer } from 'effect'
import { TaskEnvironment } from './environment'

export interface TaskRuntimeLayerOptions<ROut, E, RIn> {
  readonly taskName: string
  readonly environment: string
  readonly workflowLayer: Layer.Layer<ROut, E, RIn>
}

export const makeTaskRuntimeLayer = <ROut, E, RIn>({
  taskName,
  environment,
  workflowLayer,
}: TaskRuntimeLayerOptions<ROut, E, RIn>) =>
  Layer.mergeAll(
    workflowLayer,
    RealtimeEventsServiceLayer,
    PubSubLoggerService.withTaskName(taskName),
    TelemetryLayer(`blikka-${environment}-${taskName}`),
    Layer.effect(TaskEnvironment, TaskEnvironment.make),
  )
