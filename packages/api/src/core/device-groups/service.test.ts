import { assert, describe, it } from '@effect/vitest'
import { DeviceGroupsRepository, MarathonsRepository, type DeviceGroup } from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { ForbiddenError } from '../errors'
import { DeviceGroupsService, DeviceGroupsServiceLayerNoDeps } from './service'
import { PublicMarathonCache } from '../upload-flow/public-marathon-cache'

const domain = 'demo'
const marathonId = 1

interface TestState {
  readonly marathon: { id: number; domain: string } | undefined
  readonly deviceGroup: DeviceGroup | undefined
  readonly createCalls: ReadonlyArray<Record<string, unknown>>
  readonly invalidatedPublicMarathonDomains: ReadonlyArray<string>
}

const makeDeviceGroup = (overrides: Partial<DeviceGroup> = {}): DeviceGroup =>
  ({
    id: 7,
    marathonId,
    name: 'Station 1',
    icon: 'camera',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as DeviceGroup

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: { id: marathonId, domain },
  deviceGroup: makeDeviceGroup(),
  createCalls: [],
  invalidatedPublicMarathonDomains: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

  const deviceGroupsRepository = DeviceGroupsRepository.of({
    getDeviceGroupById: ({ id }: { id: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.deviceGroup?.id === id) {
          return Option.some(state.deviceGroup)
        }
        return Option.none()
      }),
    createDeviceGroup: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        createCalls: [...state.createCalls, data],
      })).pipe(Effect.as(makeDeviceGroup({ ...(data as Partial<DeviceGroup>) }))),
    updateDeviceGroup: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      Effect.succeed(makeDeviceGroup({ id, ...(data as Partial<DeviceGroup>) })),
    deleteDeviceGroup: ({ id }: { id: number }) => Effect.succeed(makeDeviceGroup({ id })),
  } as unknown as DeviceGroupsRepository['Service'])

  const publicMarathonCache = PublicMarathonCache.of({
    get: () => Effect.succeed(Option.none()),
    set: () => Effect.void,
    invalidate: (invalidateDomain: string) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        invalidatedPublicMarathonDomains: [
          ...state.invalidatedPublicMarathonDomains,
          invalidateDomain,
        ],
      })).pipe(Effect.asVoid),
  } as PublicMarathonCache['Service'])

  return DeviceGroupsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(DeviceGroupsRepository)(deviceGroupsRepository),
        Layer.succeed(PublicMarathonCache)(publicMarathonCache),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, DeviceGroupsService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(Effect.provide(makeTestLayer(stateRef)))

describe('DeviceGroupsService', () => {
  it.effect('defaults icon to camera when creating a device group', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* DeviceGroupsService
          return yield* service.createDeviceGroup({
            domain,
            data: {
              name: 'Station 2',
            },
          })
        }),
      )

      const state = yield* Ref.get(stateRef)
      assert.equal(state.createCalls[0]?.icon, 'camera')
      assert.equal(state.createCalls[0]?.marathonId, marathonId)
      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('invalidates the public marathon cache after updating a device group', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* DeviceGroupsService
          return yield* service.updateDeviceGroup({
            domain,
            id: 7,
            data: { name: 'Updated station' },
          })
        }),
      )

      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('invalidates the public marathon cache after deleting a device group', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* DeviceGroupsService
          return yield* service.deleteDeviceGroup({
            domain,
            id: 7,
          })
        }),
      )

      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('rejects delete when the device group belongs to another marathon', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          deviceGroup: makeDeviceGroup({ marathonId: 99 }),
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* DeviceGroupsService
          return yield* Effect.flip(
            service.deleteDeviceGroup({
              domain,
              id: 7,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, ForbiddenError)
    }),
  )
})
