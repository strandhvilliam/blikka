import { assert, describe, it } from '@effect/vitest'
import {
  CompetitionClassesRepository,
  ContactSheetsRepository,
  DeviceGroupsRepository,
  JuryRepository,
  MarathonsRepository,
  ParticipantsRepository,
  RulesRepository,
  SubmissionsRepository,
  TopicsRepository,
  UsersRepository,
  ValidationsRepository,
  VotingRepository,
} from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { BadRequestError } from '../errors'
import { makeMarathon } from '../test/fixtures/marathon'
import { SeedingService, SeedingServiceLayerNoDeps } from './service'

const domain = 'demo'

interface TestState {
  readonly marathon: ReturnType<typeof makeMarathon> | undefined
  readonly staffMembers: ReadonlyArray<Record<string, unknown>>
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon({ domain }),
  staffMembers: [
    {
      kind: 'active',
      id: 'u:staff-1',
      userId: 'staff-1',
      name: 'Staff',
      email: 'staff@example.com',
      role: 'staff',
      createdAt: '2026-01-01T00:00:00.000Z',
      status: 'active',
    },
  ],
  ...overrides,
})

const noopRepo = <T>(repository: T) => repository

const makeRepositoryLayer = (stateRef: Ref.Ref<TestState>) =>
  Layer.mergeAll(
    Layer.succeed(CompetitionClassesRepository)(
      noopRepo({} as CompetitionClassesRepository['Service']),
    ),
    Layer.succeed(ContactSheetsRepository)(noopRepo({} as ContactSheetsRepository['Service'])),
    Layer.succeed(DeviceGroupsRepository)(noopRepo({} as DeviceGroupsRepository['Service'])),
    Layer.succeed(JuryRepository)(noopRepo({} as JuryRepository['Service'])),
    Layer.succeed(ParticipantsRepository)(noopRepo({} as ParticipantsRepository['Service'])),
    Layer.succeed(RulesRepository)(noopRepo({} as RulesRepository['Service'])),
    Layer.succeed(SubmissionsRepository)(noopRepo({} as SubmissionsRepository['Service'])),
    Layer.succeed(TopicsRepository)(noopRepo({} as TopicsRepository['Service'])),
    Layer.succeed(ValidationsRepository)(noopRepo({} as ValidationsRepository['Service'])),
    Layer.succeed(VotingRepository)(noopRepo({} as VotingRepository['Service'])),
    Layer.succeed(MarathonsRepository)(
      MarathonsRepository.of({
        getMarathonByDomain: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return Option.fromNullishOr(state.marathon)
          }),
      } as unknown as MarathonsRepository['Service']),
    ),
    Layer.succeed(UsersRepository)(
      UsersRepository.of({
        getStaffMembersByDomain: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return state.staffMembers
          }),
      } as unknown as UsersRepository['Service']),
    ),
  )

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, SeedingService>,
) => effect.pipe(Effect.provide(SeedingServiceLayerNoDeps), Effect.provide(makeRepositoryLayer(stateRef)))

describe('SeedingService', () => {
  it.effect('reports blockers when caller is not admin for the domain', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())
      const previousNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* SeedingService
          return yield* service.getStatus({
            domain,
            isAdminForDomain: false,
          })
        }),
      )

      process.env.NODE_ENV = previousNodeEnv

      assert.equal(result.canRun, false)
      assert.match(result.blockers.join(' '), /admin access/)
      assert.equal(result.staffCount, 1)
    }),
  )

  it.effect('allows seeding when admin access and staff members exist in non-production', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())
      const previousNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* SeedingService
          return yield* service.getStatus({
            domain,
            isAdminForDomain: true,
          })
        }),
      )

      process.env.NODE_ENV = previousNodeEnv

      assert.equal(result.canRun, true)
      assert.deepEqual(result.blockers, [])
      assert.equal(result.preview.participants, 30)
    }),
  )

  it.effect('fails seedFinishedScenarioForDomain when status blockers remain', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ staffMembers: [] }))
      const previousNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* SeedingService
            return yield* service.seedFinishedScenarioForDomain({
              domain,
              isAdminForDomain: true,
            })
          }),
        ),
      )

      process.env.NODE_ENV = previousNodeEnv

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /staff member/)
    }),
  )
})
