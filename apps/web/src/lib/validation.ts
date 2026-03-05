import type { RuleConfig } from "@blikka/db"
import {
  RULE_KEYS,
  VALIDATION_OUTCOME,
  type RuleKey,
  type RuleParams,
  type SeverityLevel,
  type ValidationResult,
  type ValidationRule,
} from "@blikka/validation"

/**
 * Maps database rule configs to validation rules for the engine.
 * Filters to enabled rules and valid rule keys only.
 */
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

/**
 * Prepares validation rules with timerange params for WITHIN_TIMERANGE rule.
 */
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

/**
 * Returns true if any validation result is a failed error (blocking).
 */
export function hasBlockingValidationErrors(
  results: ValidationResult[],
): boolean {
  return results.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  )
}
