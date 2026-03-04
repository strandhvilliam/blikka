import { Effect, Layer, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import type { NewRuleConfig } from "../types"
import { ruleConfigs } from "../schema"
import { eq } from "drizzle-orm"
import { DbError } from "../utils"
import { conflictUpdateSetAllColumns, getDefaultRuleConfigs } from "../utils"

export class RulesQueries extends ServiceMap.Service<RulesQueries>()(
  "@blikka/db/rules-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getRulesByDomain = Effect.fn("RulesQueries.getRulesByDomain")(
        function* ({ domain }: { domain: string }) {
          const result = yield* db.query.marathons.findFirst({
            where: { domain },
            with: {
              ruleConfigs: true,
            },
          })

          const rules = result?.ruleConfigs ?? []

          if (rules.length === 0 && result?.id) {
            yield* db.insert(ruleConfigs).values(
              getDefaultRuleConfigs(result.id, {
                startDate: result.startDate,
                endDate: result.endDate,
              }),
            )
            const newResult = yield* db.query.marathons.findFirst({
              where: { id: result.id },
              with: {
                ruleConfigs: true,
              },
            })
            if (!newResult) {
              return yield* Effect.fail(
                new DbError({
                  message: "Failed to get rules",
                }),
              )
            }
            return newResult.ruleConfigs
          }
          if (rules.length === 0) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to get rules",
              }),
            )
          }

          return rules
        },
      )

      const createRuleConfig = Effect.fn("RulesQueries.createRuleConfig")(
        function* ({ data }: { data: NewRuleConfig }) {
          const [result] = yield* db
            .insert(ruleConfigs)
            .values(data)
            .returning()
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to create rule config",
              }),
            )
          }
          return result
        },
      )

      const updateRuleConfig = Effect.fn("RulesQueries.updateRuleConfig")(
        function* ({ id, data }: { id: number; data: Partial<NewRuleConfig> }) {
          const [result] = yield* db
            .update(ruleConfigs)
            .set(data)
            .where(eq(ruleConfigs.id, id))
            .returning()
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to update rule config",
              }),
            )
          }
          return result
        },
      )

      const updateMultipleRuleConfig = Effect.fn(
        "RulesQueries.updateMultipleRuleConfig",
      )(function* ({ data }: { data: NewRuleConfig[] }) {
        const result = yield* db
          .insert(ruleConfigs)
          .values(data)
          .onConflictDoUpdate({
            target: ruleConfigs.id,
            set: conflictUpdateSetAllColumns(ruleConfigs, ["id"]),
          })
          .returning()
        return result
      })

      const deleteRuleConfig = Effect.fn("RulesQueries.deleteRuleConfig")(
        function* ({ id }: { id: number }) {
          const [result] = yield* db
            .delete(ruleConfigs)
            .where(eq(ruleConfigs.id, id))
            .returning()
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to delete rule config",
              }),
            )
          }
          return result
        },
      )

      return {
        getRulesByDomain,
        createRuleConfig,
        updateMultipleRuleConfig,
        updateRuleConfig,
        deleteRuleConfig,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
