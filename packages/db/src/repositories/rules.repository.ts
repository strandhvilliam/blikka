import { Effect, Layer, Context } from 'effect'
import { DrizzleClient } from '../drizzle-client'
import type { NewRuleConfig, RuleConfig } from '../types'
import { ruleConfigs } from '../schema'
import { eq } from 'drizzle-orm'
import { DbError } from '../utils'
import { conflictUpdateSetAllColumns, getDefaultRuleConfigs } from '../utils'
export class RulesRepository extends Context.Service<
  RulesRepository,
  {
    /** Rule configs for the marathon identified by domain, creating defaults if needed. */
    readonly getRulesByDomain: (params: { domain: string }) => Effect.Effect<RuleConfig[], DbError>
    /** Insert a new rule config row. */
    readonly createRuleConfig: (params: {
      data: NewRuleConfig
    }) => Effect.Effect<RuleConfig, DbError>
    /** Upsert multiple rule config rows. */
    readonly updateMultipleRuleConfig: (params: {
      data: NewRuleConfig[]
    }) => Effect.Effect<RuleConfig[], DbError>
    /** Patch fields on a rule config identified by id. */
    readonly updateRuleConfig: (params: {
      id: number
      data: Partial<NewRuleConfig>
    }) => Effect.Effect<RuleConfig, DbError>
    /** Delete a rule config by id. */
    readonly deleteRuleConfig: (params: { id: number }) => Effect.Effect<RuleConfig, DbError>
  }
>()('@blikka/db/rules-repository') {}

const makeRulesRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient
  const getRulesByDomain: RulesRepository['Service']['getRulesByDomain'] = Effect.fn(
    'RulesRepository.getRulesByDomain',
  )(function* ({ domain }) {
    const result = yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.domain, domain),
        with: {
          ruleConfigs: true,
        },
      }),
    )
    const rules = result?.ruleConfigs ?? []
    if (rules.length === 0 && result?.id) {
      yield* use((db) =>
        db.insert(ruleConfigs).values(
          getDefaultRuleConfigs(result.id, {
            startDate: result.startDate,
            endDate: result.endDate,
          }),
        ),
      )
      const newResult = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.id, result.id),
          with: {
            ruleConfigs: true,
          },
        }),
      )
      if (!newResult) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to get rules',
          }),
        )
      }
      return newResult.ruleConfigs
    }
    if (rules.length === 0) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to get rules',
        }),
      )
    }
    return rules
  })

  const createRuleConfig: RulesRepository['Service']['createRuleConfig'] = Effect.fn(
    'RulesRepository.createRuleConfig',
  )(function* ({ data }) {
    const [result] = yield* use((db) => db.insert(ruleConfigs).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to create rule config',
        }),
      )
    }
    return result
  })

  const updateRuleConfig: RulesRepository['Service']['updateRuleConfig'] = Effect.fn(
    'RulesRepository.updateRuleConfig',
  )(function* ({ id, data }) {
    const [result] = yield* use((db) =>
      db.update(ruleConfigs).set(data).where(eq(ruleConfigs.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to update rule config',
        }),
      )
    }
    return result
  })

  const updateMultipleRuleConfig: RulesRepository['Service']['updateMultipleRuleConfig'] =
    Effect.fn('RulesRepository.updateMultipleRuleConfig')(function* ({ data }) {
      const result = yield* use((db) =>
        db
          .insert(ruleConfigs)
          .values(data)
          .onConflictDoUpdate({
            target: ruleConfigs.id,
            set: conflictUpdateSetAllColumns(ruleConfigs),
          })
          .returning(),
      )
      return result
    })

  const deleteRuleConfig: RulesRepository['Service']['deleteRuleConfig'] = Effect.fn(
    'RulesRepository.deleteRuleConfig',
  )(function* ({ id }) {
    const [result] = yield* use((db) =>
      db.delete(ruleConfigs).where(eq(ruleConfigs.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to delete rule config',
        }),
      )
    }
    return result
  })

  return RulesRepository.of({
    getRulesByDomain,
    createRuleConfig,
    updateMultipleRuleConfig,
    updateRuleConfig,
    deleteRuleConfig,
  })
})

export const RulesRepositoryLayerNoDeps = Layer.effect(RulesRepository, makeRulesRepository)

export const RulesRepositoryLayer = RulesRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
