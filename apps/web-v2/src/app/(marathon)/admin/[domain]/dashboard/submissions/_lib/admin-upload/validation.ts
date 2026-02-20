import { Effect } from "effect";
import type { RuleConfig } from "@blikka/db";
import {
  GroupedValidationsService,
  RULE_KEYS,
  SingleValidationsService,
  VALIDATION_OUTCOME,
  ValidationEngine,
  type RuleKey,
  type RuleParams,
  type SeverityLevel,
  type ValidationInput,
  type ValidationResult,
  type ValidationRule,
} from "@blikka/validation";
import type { AdminSelectedPhoto } from "./types";

interface RunAdminPhotoValidationInput {
  photos: AdminSelectedPhoto[];
  ruleConfigs: RuleConfig[];
  marathonStartDate?: string | Date | null;
  marathonEndDate?: string | Date | null;
}

function mapRuleConfigsToValidationRules(
  dbRuleConfigs: RuleConfig[],
): ValidationRule[] {
  const validRuleKeys = new Set(Object.values(RULE_KEYS));

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
    }));
}

function prepareValidationRules(
  rules: ValidationRule[],
  marathonStartDate?: string | Date | null,
  marathonEndDate?: string | Date | null,
): ValidationRule[] {
  return rules.map((rule) => {
    if (
      rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE &&
      marathonStartDate &&
      marathonEndDate
    ) {
      return {
        ...rule,
        params: {
          ...rule.params,
          [RULE_KEYS.WITHIN_TIMERANGE]: {
            start:
              marathonStartDate instanceof Date
                ? marathonStartDate.toISOString()
                : new Date(marathonStartDate).toISOString(),
            end:
              marathonEndDate instanceof Date
                ? marathonEndDate.toISOString()
                : new Date(marathonEndDate).toISOString(),
          },
        },
      };
    }

    return rule;
  });
}

export function hasBlockingValidationErrors(
  results: ValidationResult[],
): boolean {
  return results.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  );
}

export async function runAdminPhotoValidation({
  photos,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: RunAdminPhotoValidationInput): Promise<ValidationResult[]> {
  if (photos.length === 0) {
    return [];
  }

  const rules = prepareValidationRules(
    mapRuleConfigsToValidationRules(ruleConfigs),
    marathonStartDate,
    marathonEndDate,
  );

  if (rules.length === 0) {
    return [];
  }

  const validationInputs: ValidationInput[] = photos.map((photo) => ({
    exif: photo.exif,
    fileName: photo.file.name,
    fileSize: photo.file.size,
    orderIndex: photo.orderIndex,
    mimeType: photo.file.type,
  }));

  const program = Effect.gen(function* () {
    const engine = yield* ValidationEngine;
    return yield* engine.runValidations(rules, validationInputs);
  }).pipe(
    Effect.provide(ValidationEngine.Default),
    Effect.provide(SingleValidationsService.Default),
    Effect.provide(GroupedValidationsService.Default),
  );

  return Effect.runPromise(program);
}
