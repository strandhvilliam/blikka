
import { Effect, Layer, Context } from 'effect'
import {
  DbLayer,
  MarathonsRepository,
  RulesRepository,
  type NewRuleConfig,
  type RuleConfig,
  DbError,
} from '@blikka/db'
import { NotFoundError, failNotFoundIfNone } from '../errors'
import type { GetByDomainInput, UpdateMultipleInput } from './contracts'

export class RulesService extends Context.Service<
  RulesService,
  {
    /** Returns every rule configuration for the marathon tied to this domain (hostname). */
    readonly getRulesByDomain: (input: GetByDomainInput) => Effect.Effect<RuleConfig[], DbError>

    /**
     * Patches existing rules keyed by `ruleKey` with optional `params`, `severity`, and `enabled`;
     * resolves the marathon from `domain`, then persists the merged rows.
     */
    readonly updateMultipleRules: (
      input: UpdateMultipleInput,
    ) => Effect.Effect<RuleConfig[], DbError | NotFoundError, never>
  }
>()('@blikka/api/RulesService') {}

const makeRulesService = Effect.gen(function* () {
  const rulesRepository = yield* RulesRepository
  const marathonsRepository = yield* MarathonsRepository

  const getRulesByDomain: RulesService['Service']['getRulesByDomain'] = Effect.fn(
    'RulesService.getRulesByDomain',
  )(function* ({ domain }) {
    return yield* rulesRepository.getRulesByDomain({ domain })
  })

  const updateMultipleRules: RulesService['Service']['updateMultipleRules'] = Effect.fn(
    'RulesService.updateMultipleRules',
  )(function* ({ domain, data }) {
    const existingRules = yield* rulesRepository.getRulesByDomain({
      domain,
    })

    const marathon = yield* marathonsRepository
      .getMarathonByDomainWithOptions({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    const now = new Date().toISOString()
    const rulesToUpdate: NewRuleConfig[] = existingRules.reduce((acc, rule) => {
      const ruleToUpdate = data.find((item) => item.ruleKey === rule.ruleKey)
      if (ruleToUpdate) {
        acc.push({
          id: rule.id,
          createdAt: rule.createdAt,
          updatedAt: now,
          ruleKey: rule.ruleKey,
          marathonId: marathon.id,
          params: ruleToUpdate.params ?? rule.params,
          severity: ruleToUpdate.severity ?? rule.severity,
          enabled: ruleToUpdate.enabled ?? rule.enabled,
        })
      }
      return acc
    }, [] as NewRuleConfig[])

    const result = yield* rulesRepository.updateMultipleRuleConfig({
      data: rulesToUpdate,
    })

    return result
  })

  return RulesService.of({
    getRulesByDomain,
    updateMultipleRules,
  })
})

export const RulesServiceLayerNoDeps = Layer.effect(RulesService, makeRulesService)

export const RulesServiceLayer = RulesServiceLayerNoDeps.pipe(Layer.provide(DbLayer))
