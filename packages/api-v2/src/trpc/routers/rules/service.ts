import "server-only"

import { Effect, Option } from "effect"
import {
  type NewRuleConfig,
  type RuleConfig, Database } from "@blikka/db"
import { RulesApiError } from "./schemas"

export class RulesApiService extends Effect.Service<RulesApiService>()(
  "@blikka/api-v2/RulesApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function*() {
      const db = yield* Database

      const getRulesByDomain = Effect.fn("RulesService.getRulesByDomain")(function*({
        domain,
      }: {
        domain: string
      }) {
        return yield* db.rulesQueries.getRulesByDomain({ domain })
      })

      const updateMultipleRules = Effect.fn("RulesService.updateMultipleRules")(function*({
        domain,
        data,
      }: {
        domain: string
        data: Array<{
          ruleKey: string
          params?: Record<string, unknown> | null | undefined
          severity?: string
          enabled?: boolean
        }>
      }) {
        const existingRules = yield* db.rulesQueries.getRulesByDomain({ domain })

        const marathon = yield* db.marathonsQueries.getMarathonByDomainWithOptions({
          domain,
        })

        const marathonId = yield* Option.match(marathon, {
          onSome: (m) => Effect.succeed(m.id),
          onNone: () =>
            Effect.fail(
              new RulesApiError({
                message: `Marathon not found for domain ${domain}`,
              })
            ),
        })

        const now = new Date().toISOString()
        const rulesToUpdate: NewRuleConfig[] = existingRules.reduce(
          (acc, rule) => {
            const ruleToUpdate = data.find((item) => item.ruleKey === rule.ruleKey)
            if (ruleToUpdate) {
              acc.push({
                id: rule.id,
                createdAt: rule.createdAt,
                updatedAt: now,
                ruleKey: rule.ruleKey,
                marathonId,
                params: ruleToUpdate.params ?? rule.params,
                severity: ruleToUpdate.severity ?? rule.severity,
                enabled: ruleToUpdate.enabled ?? rule.enabled,
              })
            }
            return acc
          },
          [] as Array<{
            id: number
            createdAt: string
            updatedAt: string | null
            ruleKey: string
            marathonId: number
            params: Record<string, unknown> | null | undefined
            severity: string
            enabled: boolean
          }>
        )

        console.log('rulesToUpdate', rulesToUpdate)


        const result = yield* db.rulesQueries.updateMultipleRuleConfig({
          data: rulesToUpdate,
        })

        return result
      })

      return {
        getRulesByDomain,
        updateMultipleRules,
      } as const
    }),
  }
) {
}
