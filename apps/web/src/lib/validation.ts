import type { RuleConfig } from "@blikka/db"
import {
  RULE_KEYS,
  VALIDATION_OUTCOME,
  ValidationEngine,
  ValidationInput,
  type RuleKey,
  type RuleParams,
  type SeverityLevel,
  type ValidationResult,
  type ValidationRule,
} from "@blikka/validation"
import { clientRuntime } from "./client-runtime"
import { Effect } from "effect"

export function mapRuleConfigsToValidationRules(
  dbRuleConfigs: RuleConfig[],
): ValidationRule[] {
  const validRuleKeys = new Set(Object.values(RULE_KEYS))

  return dbRuleConfigs
    .filter((rule) => rule.enabled)
    .filter((rule) => validRuleKeys.has(rule.ruleKey as RuleKey))
    .map((rule) => ({
      ruleKey: rule.ruleKey as RuleKey,
      enabled: rule.enabled,
      severity: rule.severity as SeverityLevel,
      params: {
        [rule.ruleKey]: rule.params,
      } as RuleParams,
    }))
}

export interface PrepareValidationRulesOptions {
  start?: string | Date | null
  end?: string | Date | null
}

export function prepareValidationRules(
  rules: ValidationRule[],
  options: PrepareValidationRulesOptions,
): ValidationRule[] {
  const { start, end } = options

  return rules.map((rule) => {
    if (
      rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE &&
      start &&
      end
    ) {
      return {
        ...rule,
        params: {
          ...rule.params,
          [RULE_KEYS.WITHIN_TIMERANGE]: {
            start:
              start instanceof Date
                ? start.toISOString()
                : new Date(start).toISOString(),
            end:
              end instanceof Date
                ? end.toISOString()
                : new Date(end).toISOString(),
          },
        },
      }
    }

    return rule
  })
}

export function hasBlockingValidationErrors(
  results: ValidationResult[],
): boolean {
  return results.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  )
}


export async function runClientValidation(rules: ValidationRule[], inputs: ValidationInput[]) {
  return await clientRuntime.runPromise(
    Effect.gen(function* () {
      const engine = yield* ValidationEngine
      return yield* engine.runValidations(rules, inputs)
    }),
  )
} 