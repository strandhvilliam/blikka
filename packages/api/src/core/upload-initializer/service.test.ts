import { assert, describe, it } from '@effect/vitest'
import { RealtimeEventsService } from '@blikka/realtime'
import { Effect, Layer, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import {
  ByCameraUploadInitializerService,
} from './initialize-by-camera-upload'
import {
  MarathonUploadInitializerService,
} from './initialize-marathon-upload'
import {
  UploadInitializerService,
  UploadInitializerServiceLayerNoDeps,
} from './service'

interface TestState {
  readonly marathonCalls: ReadonlyArray<Record<string, unknown>>
  readonly byCameraCalls: ReadonlyArray<Record<string, unknown>>
  readonly realtimeEvents: ReadonlyArray<{
    eventKey: string
    environment: string
    domain: string
    reference?: string
  }>
  readonly nodeEnv: string
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathonCalls: [],
  byCameraCalls: [],
  realtimeEvents: [],
  nodeEnv: 'development',
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonUploadInitializer = MarathonUploadInitializerService.of({
    initializeUploadFlow: (input) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        marathonCalls: [...state.marathonCalls, input as Record<string, unknown>],
      })).pipe(
        Effect.as({
          uploadSessionId: 'session-1',
          reference: input.reference,
          uploads: [],
        }),
      ),
  })

  const byCameraUploadInitializer = ByCameraUploadInitializerService.of({
    initializeByCameraUpload: (input) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        byCameraCalls: [...state.byCameraCalls, input as Record<string, unknown>],
      })).pipe(
        Effect.as({
          participantId: 42,
          reference: input.variant === 'staff' ? input.reference : '5678',
          uploadSessionId: 'session-2',
          uploads: [],
        }),
      ),
  })

  const realtimeEvents = RealtimeEventsService.of({
      withEventResult: (
        effect: Effect.Effect<unknown, unknown, unknown>,
        event: {
          eventKey: string
          environment: string
          domain: string
          reference?: string
        },
      ) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          realtimeEvents: [
            ...state.realtimeEvents,
            {
              eventKey: event.eventKey,
              environment: event.environment,
              domain: event.domain,
              reference: event.reference,
            },
          ],
        })).pipe(Effect.flatMap(() => effect)),
      emitEventResult: () => Effect.void,
      emitVotingVoteCast: () => Effect.void,
  } as unknown as RealtimeEventsService['Service'])

  return UploadInitializerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonUploadInitializerService)(marathonUploadInitializer),
        Layer.succeed(ByCameraUploadInitializerService)(byCameraUploadInitializer),
        Layer.succeed(RealtimeEventsService)(realtimeEvents),
        configLayerFromEnv({ NODE_ENV: 'development' }),
      ),
    ),
  )
}

const makeProductionLayer = (stateRef: Ref.Ref<TestState>) =>
  UploadInitializerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonUploadInitializerService)(
          MarathonUploadInitializerService.of({
            initializeUploadFlow: () => Effect.succeed({ uploadSessionId: 's', reference: 'r', uploads: [] }),
          }),
        ),
        Layer.succeed(ByCameraUploadInitializerService)(
          ByCameraUploadInitializerService.of({
            initializeByCameraUpload: () =>
              Effect.succeed({
                participantId: 1,
                reference: 'r',
                uploadSessionId: 's',
                uploads: [],
              }),
          }),
        ),
        Layer.succeed(RealtimeEventsService)(
          RealtimeEventsService.of({
              withEventResult: (
                effect: Effect.Effect<unknown, unknown, unknown>,
                event: {
                  eventKey: string
                  environment: string
                  domain: string
                  reference?: string
                },
              ) =>
                updateTestState(stateRef, (state) => ({
                  ...state,
                  realtimeEvents: [
                    ...state.realtimeEvents,
                    {
                      eventKey: event.eventKey,
                      environment: event.environment,
                      domain: event.domain,
                      reference: event.reference,
                    },
                  ],
                })).pipe(Effect.flatMap(() => effect)),
              emitEventResult: () => Effect.void,
              emitVotingVoteCast: () => Effect.void,
          } as unknown as RealtimeEventsService['Service']),
        ),
        configLayerFromEnv({ NODE_ENV: 'production' }),
      ),
    ),
  )

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, UploadInitializerService>,
  layerFactory: (stateRef: Ref.Ref<TestState>) => Layer.Layer<UploadInitializerService, unknown> = makeTestLayer,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(layerFactory(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('UploadInitializerService', () => {
  it.effect('initializeUploadFlow delegates to marathon initializer and emits upload-flow-initialized', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* UploadInitializerService
          return yield* service.initializeUploadFlow({
            domain: 'demo',
            reference: '1234',
            firstname: 'Ada',
            lastname: 'Lovelace',
            email: 'ada@example.com',
            competitionClassId: 5,
            deviceGroupId: 7,
          })
        }),
      )

      assert.strictEqual(result.reference, '1234')
      assert.lengthOf(state.marathonCalls, 1)
      assert.deepStrictEqual(state.realtimeEvents, [
        {
          eventKey: 'upload-flow-initialized',
          environment: 'dev',
          domain: 'demo',
          reference: '1234',
        },
      ])
    }),
  )

  it.effect('initializeByCameraUpload delegates to by-camera initializer', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* UploadInitializerService
          return yield* service.initializeByCameraUpload({
            variant: 'device',
            domain: 'demo',
            firstname: 'Ada',
            lastname: 'Lovelace',
            email: 'ada@example.com',
            deviceGroupId: 7,
            phoneNumber: '+4712345678',
          })
        }),
      )

      assert.lengthOf(state.byCameraCalls, 1)
      assert.deepStrictEqual(state.realtimeEvents, [
        {
          eventKey: 'upload-flow-initialized',
          environment: 'dev',
          domain: 'demo',
          reference: undefined,
        },
      ])
    }),
  )

  it.effect('maps NODE_ENV production to prod environment in realtime events', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState(),
        () =>
          Effect.gen(function* () {
            const service = yield* UploadInitializerService
            return yield* service.initializeUploadFlow({
              domain: 'demo',
              reference: '1234',
              firstname: 'Ada',
              lastname: 'Lovelace',
              email: 'ada@example.com',
              competitionClassId: 5,
              deviceGroupId: 7,
            })
          }),
        makeProductionLayer,
      )

      assert.strictEqual(state.realtimeEvents[0]?.environment, 'prod')
    }),
  )
})
