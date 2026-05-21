import { assert, describe, it } from '@effect/vitest'
import {
  MarathonsRepository,
  UsersRepository,
  ValidationsRepository,
  type User,
} from '@blikka/db'
import { RedisClient } from '@blikka/redis'
import { Effect, Layer, Option, Ref } from 'effect'

import { BadRequestError, NotFoundError } from '../errors'
import { UsersService, UsersServiceLayerNoDeps } from './service'

const domain = 'demo'
const marathonId = 1

interface TestState {
  readonly marathon: { id: number; domain: string } | undefined
  readonly user: User | undefined
  readonly pendingInvites: ReadonlyArray<Record<string, unknown>>
  readonly relations: ReadonlyArray<Record<string, unknown>>
  readonly deletedPendingIds: number[]
  readonly deletedRelationCalls: ReadonlyArray<{ userId: string; marathonId: number }>
  readonly permissionCacheClears: string[]
}

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    name: 'Staff User',
    email: 'staff@example.com',
    emailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    image: null,
    ...overrides,
  }) as User

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: { id: marathonId, domain },
  user: undefined,
  pendingInvites: [],
  relations: [],
  deletedPendingIds: [],
  deletedRelationCalls: [],
  permissionCacheClears: [],
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

  const usersRepository = UsersRepository.of({
    getStaffMembersByDomain: () => Effect.succeed([]),
    getStaffMemberById: () => Effect.succeed(Option.none()),
    getPendingUserMarathonById: ({ pendingId }: { pendingId: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const pending = state.pendingInvites.find((row) => row.id === pendingId)
        return Option.fromNullishOr(pending)
      }),
    getUserByNormalizedEmail: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.user)
      }),
    upsertUserMarathonRelation: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        relations: [...state.relations, data],
      })).pipe(
        Effect.as({
          id: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          ...data,
        }),
      ),
    getPendingUserMarathonsByEmailNormalized: () => Effect.succeed([]),
    upsertPendingUserMarathon: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        pendingInvites: [...state.pendingInvites, { id: 42, createdAt: '2026-01-01T00:00:00.000Z', ...data }],
      })).pipe(
        Effect.as({
          id: 42,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: null,
          invitedByUserId: null,
          ...data,
        }),
      ),
    deleteUserMarathonRelation: ({ userId, marathonId: mid }: { userId: string; marathonId: number }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        deletedRelationCalls: [...state.deletedRelationCalls, { userId, marathonId: mid }],
      })).pipe(
        Effect.as({
          id: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          marathonId: mid,
          role: 'staff',
          userId,
        }),
      ),
    deletePendingUserMarathon: ({ id }: { id: number }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        deletedPendingIds: [...state.deletedPendingIds, id],
      })).pipe(Effect.as(undefined)),
    updateUser: () => Effect.void,
    updateUserMarathonRelation: () => Effect.void,
    updatePendingUserMarathon: () => Effect.void,
  } as unknown as UsersRepository['Service'])

  const validationsRepository = ValidationsRepository.of({
    getParticipantVerificationsByStaffId: () =>
      Effect.succeed({ items: [], nextCursor: undefined }),
  } as unknown as ValidationsRepository['Service'])

  const redisClient = RedisClient.of({
    use: (fn) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const client = {
          del: (key: string) => {
            if (key.startsWith('permissions:')) {
              state.permissionCacheClears.push(key.replace('permissions:', ''))
            }
            return Promise.resolve(1)
          },
        }
        return fn(client as never)
      }),
    client: {} as never,
  } as unknown as RedisClient['Service'])

  return UsersServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(UsersRepository)(usersRepository),
        Layer.succeed(ValidationsRepository)(validationsRepository),
        Layer.succeed(RedisClient)(redisClient),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, UsersService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(Effect.provide(makeTestLayer(stateRef)))

describe('UsersService', () => {
  it.effect('creates a pending invite when no user exists for the email', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* UsersService
          return yield* service.createStaffMember({
            domain,
            data: {
              name: 'New Staff',
              email: 'new@example.com',
              role: 'staff',
            },
          })
        }),
      )

      assert.equal(result.kind, 'pending')
      assert.equal(result.pendingId, 42)
      assert.equal(result.status, 'pending')
    }),
  )

  it.effect('links an existing user and clears permission cache', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          user: makeUser(),
        }),
      )

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* UsersService
          return yield* service.createStaffMember({
            domain,
            data: {
              name: 'Staff User',
              email: 'staff@example.com',
              role: 'admin',
            },
          })
        }),
      )

      assert.equal(result.kind, 'active')
      assert.equal(result.userId, 'user-1')
      assert.equal(state.relations[0]?.marathonId, marathonId)
      assert.deepEqual(state.permissionCacheClears, ['user-1'])
    }),
  )

  it.effect('rejects invalid staff access ids', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* UsersService
          return yield* Effect.flip(
            service.getStaffAccessById({
              domain,
              accessId: 'invalid-id',
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('deletes pending staff access by pending id', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          pendingInvites: [
            {
              id: 7,
              marathonId,
              name: 'Pending',
              email: 'pending@example.com',
              role: 'staff',
            },
          ],
        }),
      )

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* UsersService
          return yield* service.deleteStaffAccess({
            domain,
            accessId: 'p:7',
          })
        }),
      )

      assert.deepEqual(state.deletedPendingIds, [7])
    }),
  )

  it.effect('fails createStaffMember when marathon is not found', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ marathon: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* UsersService
          return yield* Effect.flip(
            service.createStaffMember({
              domain,
              data: {
                name: 'Staff',
                email: 'staff@example.com',
                role: 'staff',
              },
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )
})
