import type { RealtimeEventKey } from '@blikka/realtime'
import { RealtimeEventsService } from '@blikka/realtime'
import { Effect, Layer } from 'effect'
import { TaskEnvironment } from './environment'
import { makeTaskRuntimeLayer } from './layer'
import type { TaskEventTarget } from './lambda'

export interface ContainerRealtimeTaskOptions<Input extends TaskEventTarget, R> {
  readonly taskName: string
  readonly spanName: string
  readonly eventKey: RealtimeEventKey
  readonly parseInput: Effect.Effect<Input, unknown, R>
  readonly run: (input: Input) => Effect.Effect<unknown, unknown, R>
  readonly successMessage?: string
  readonly failureMessage?: string
}

export interface ContainerTaskLayerOptions<ROut, E, RIn> {
  readonly taskName: string
  readonly environment: string
  readonly workflowLayer: Layer.Layer<ROut, E, RIn>
}

export const makeContainerRealtimeTask = <Input extends TaskEventTarget, R>(
  options: ContainerRealtimeTaskOptions<Input, R>,
) =>
  Effect.gen(function* () {
    const realtimeEvents = yield* RealtimeEventsService
    const taskEnvironment = yield* TaskEnvironment
    const input = yield* options.parseInput

    const workflow = options
      .run(input)
      .pipe(
        Effect.tap(() =>
          options.successMessage ? Effect.logInfo(options.successMessage) : Effect.void,
        ),
      )

    yield* realtimeEvents
      .withEventResult(workflow, {
        eventKey: options.eventKey,
        environment: taskEnvironment.environment,
        domain: input.domain,
        reference: input.reference,
        metadata: input.metadata,
      })
      .pipe(
        Effect.annotateLogs({
          domain: input.domain,
          reference: input.reference,
        }),
      )
  }).pipe(
    Effect.withSpan(options.spanName),
    Effect.tapError((error) =>
      Effect.logError(options.failureMessage ?? `${options.taskName} failed`, error),
    ),
  )

export const makeContainerTaskLayer = <ROut, E, RIn>(
  options: ContainerTaskLayerOptions<ROut, E, RIn>,
) => makeTaskRuntimeLayer(options)

export const runContainerTask = <A, E, R, ELayer>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, ELayer>,
) => Effect.runPromise(effect.pipe(Effect.provide(layer)))
