import "server-only";

import { Effect, Layer, Option, Context } from "effect";
import {
  DbLayer,
  MarathonsRepository,
  RulesRepository,
  type NewRuleConfig,
  type RuleConfig,
} from "@blikka/db";
import { RulesApiError } from "./schemas";

export class RulesApiService extends Context.Service<RulesApiService>()(
  "@blikka/api/RulesApiService",
  {
    make: Effect.gen(function* () {
      const rulesRepository = yield* RulesRepository;
      const marathonsRepository = yield* MarathonsRepository;

      const getRulesByDomain = Effect.fn("RulesService.getRulesByDomain")(
        function* ({ domain }: { domain: string }) {
          return yield* rulesRepository.getRulesByDomain({ domain });
        },
      );

      const updateMultipleRules = Effect.fn("RulesService.updateMultipleRules")(
        function* ({
          domain,
          data,
        }: {
          domain: string;
          data: Array<{
            ruleKey: string;
            params?: Record<string, unknown> | null | undefined;
            severity?: string;
            enabled?: boolean;
          }>;
        }) {
          const existingRules = yield* rulesRepository.getRulesByDomain({
            domain,
          });

          const marathon =
            yield* marathonsRepository.getMarathonByDomainWithOptions({
              domain,
            });

          const marathonId = yield* Option.match(marathon, {
            onSome: (m) => Effect.succeed(m.id),
            onNone: () =>
              Effect.fail(
                new RulesApiError({
                  message: `Marathon not found for domain ${domain}`,
                }),
              ),
          });

          const now = new Date().toISOString();
          const rulesToUpdate: NewRuleConfig[] = existingRules.reduce(
            (acc, rule) => {
              const ruleToUpdate = data.find(
                (item) => item.ruleKey === rule.ruleKey,
              );
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
                });
              }
              return acc;
            },
            [] as Array<{
              id: number;
              createdAt: string;
              updatedAt: string | null;
              ruleKey: string;
              marathonId: number;
              params: Record<string, unknown> | null | undefined;
              severity: string;
              enabled: boolean;
            }>,
          );

          const result = yield* rulesRepository.updateMultipleRuleConfig({
            data: rulesToUpdate,
          });

          return result;
        },
      );

      return {
        getRulesByDomain,
        updateMultipleRules,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DbLayer),
  );
}
