import { assert, describe, it } from '@effect/vitest'
import { MarathonsRepository, RulesRepository, type RuleConfig } from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { NotFoundError } from '../errors'
import { RulesService, RulesServiceLayerNoDeps } from './service'
import { PublicMarathonCache } from '../upload-flow/public-marathon-cache'

const domain = 'demo'

interface TestState {
  readonly rules: RuleConfig[]
  readonly marathon: { id: number; domain: string } | undefined
  readonly updateCalls: ReadonlyArray<RuleConfig[]>
  readonly invalidatedPublicMarathonDomains: ReadonlyArray<string>
}

const makeRule = (overrides: Partial<RuleConfig> = {}): RuleConfig =>
  ({
    id: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ruleKey: 'rule-a',
    marathonId: 1,
    params: { minWidth: 1000 },
    severity: 'warning',
    enabled: true,
    ...overrides,
  }) as RuleConfig

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  rules: [
    makeRule({ id: 1, ruleKey: 'rule-a', params: { minWidth: 1000 }, severity: 'warning' }),
    makeRule({ id: 2, ruleKey: 'rule-b', params: { maxSize: 10 }, severity: 'error', enabled: false }),
  ],
  marathon: { id: 1, domain },
  updateCalls: [],
  invalidatedPublicMarathonDomains: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const rulesRepository = RulesRepository.of({
    getRulesByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.rules
      }),
    updateMultipleRuleConfig: ({ data }: { data: RuleConfig[] }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        updateCalls: [...state.updateCalls, data as RuleConfig[]],
      })).pipe(Effect.as(data as RuleConfig[])),
  } as unknown as RulesRepository['Service'])

  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomainWithOptions: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

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

  return RulesServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(RulesRepository)(rulesRepository),
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(PublicMarathonCache)(publicMarathonCache),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, RulesService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(Effect.provide(makeTestLayer(stateRef)))

describe('RulesService', () => {
  it.effect('merges only matching rules and preserves untouched fields', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* RulesService
          return yield* service.updateMultipleRules({
            domain,
            data: [
              {
                ruleKey: 'rule-a',
                params: { minWidth: 2000 },
                enabled: false,
              },
            ],
          })
        }),
      )

      assert.equal(state.updateCalls.length, 1)
      assert.equal(state.updateCalls[0]?.length, 1)

      const updatedRule = state.updateCalls[0]?.[0]
      assert.isDefined(updatedRule)
      assert.equal(updatedRule.ruleKey, 'rule-a')
      assert.equal(updatedRule.params?.minWidth, 2000)
      assert.equal(updatedRule.severity, 'warning')
      assert.equal(updatedRule.enabled, false)
      assert.equal(updatedRule.marathonId, 1)
      assert.notEqual(updatedRule.updatedAt, '2026-01-01T00:00:00.000Z')
      assert.equal(result.length, 1)
      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('ignores update payloads that do not match existing rule keys', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* RulesService
          return yield* service.updateMultipleRules({
            domain,
            data: [{ ruleKey: 'missing-rule', enabled: true }],
          })
        }),
      )

      assert.equal(state.updateCalls[0]?.length, 0)
    }),
  )

  it.effect('fails when marathon is not found', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ marathon: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* RulesService
          return yield* Effect.flip(
            service.updateMultipleRules({
              domain,
              data: [{ ruleKey: 'rule-a', enabled: false }],
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )
})
