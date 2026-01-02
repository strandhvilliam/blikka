import "server-only"

import { Effect, Option } from "effect"
import { Database, type NewMarathon } from "@blikka/db"
import { MarathonApiError } from "./schemas"
import { RULE_KEYS } from "@blikka/validation"

export class MarathonApiService extends Effect.Service<MarathonApiService>()(
  "@blikka/api-v2/MarathonApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database

      const getMarathonByDomain = Effect.fn("MarathonApiService.getMarathonByDomain")(function* ({
        domain,
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomainWithOptions({ domain })
        return yield* Option.match(marathon, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new MarathonApiError({
                message: `Marathon not found for domain ${domain}`,
              })
            ),
        })
      })

      const getUserMarathons = Effect.fn("MarathonApiService.getUserMarathons")(function* ({
        userId,
      }) {
        return yield* db.usersQueries.getMarathonsByUserId({ userId })
      })

      const updateMarathon = Effect.fn("MarathonApiService.updateMarathon")(function* ({
        domain,
        data,
      }: {
        domain: string
        data: Partial<NewMarathon>
      }) {
        const updateData = {
          ...data,
          updatedAt: new Date().toISOString(),
        } satisfies Partial<NewMarathon>

        const result = yield* db.marathonsQueries.updateMarathonByDomain({
          domain,
          data: updateData,
        })

        if (data.startDate !== undefined || data.endDate !== undefined) {
          const rules = yield* db.rulesQueries.getRulesByDomain({ domain })
          const withinTimerangeRule = rules.find(
            (rule) => rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE
          )

          if (withinTimerangeRule) {
            const marathonAfterUpdate = yield* db.marathonsQueries.getMarathonByDomain({
              domain,
            })
            const finalMarathon = yield* Option.match(marathonAfterUpdate, {
              onSome: (m) => Effect.succeed(m),
              onNone: () =>
                Effect.fail(
                  new MarathonApiError({
                    message: `Marathon not found after update for domain ${domain}`,
                  })
                ),
            })

            yield* db.rulesQueries.updateRuleConfig({
              id: withinTimerangeRule.id,
              data: {
                params: {
                  start: finalMarathon.startDate,
                  end: finalMarathon.endDate,
                },
              },
            })
          }
        }

        return result
      })

      const resetMarathon = Effect.fn("MarathonApiService.resetMarathon")(function* ({
        domain,
      }: {
        domain: string
      }) {
        const marathonId = yield* db.marathonsQueries.getMarathonByDomain({ domain }).pipe(
          Effect.andThen(
            Option.match({
              onSome: (m) => Effect.succeed(m.id),
              onNone: () =>
                Effect.fail(
                  new MarathonApiError({
                    message: `Marathon not found for domain ${domain}`,
                  })
                ),
            })
          )
        )

        return yield* db.marathonsQueries.resetMarathon({ id: marathonId })
      })

      return {
        getMarathonByDomain,
        getUserMarathons,
        updateMarathon,
        resetMarathon,
      } as const
    }),
  }
) {}
