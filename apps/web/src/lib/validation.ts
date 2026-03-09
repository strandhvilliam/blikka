import type { RuleConfig } from "@blikka/db";
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
} from "@blikka/validation";
import { clientRuntime } from "./client-runtime";
import { Effect } from "effect";

export function mapRuleConfigsToValidationRules(
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

export interface PrepareValidationRulesOptions {
  start?: string | Date | null;
  end?: string | Date | null;
}

export function prepareValidationRules(
  rules: ValidationRule[],
  options: PrepareValidationRulesOptions,
): ValidationRule[] {
  const { start, end } = options;

  return rules.map((rule) => {
    if (rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE && start && end) {
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

export interface ValidatablePhotoLike {
  exif: Record<string, unknown>;
  file: {
    name: string;
    size: number;
    type: string;
  };
  orderIndex: number;
}

export function buildValidationInputs(
  photos: ValidatablePhotoLike[],
): ValidationInput[] {
  return photos.map((photo) => ({
    exif: photo.exif,
    fileName: photo.file.name,
    fileSize: photo.file.size,
    orderIndex: photo.orderIndex,
    mimeType: photo.file.type,
  }));
}

export function createValidationResultKey(result: ValidationResult) {
  return [
    result.ruleKey,
    result.message,
    result.outcome,
    result.severity,
    result.orderIndex ?? "none",
    result.fileName ?? "none",
    result.isGeneral ? "general" : "file",
  ].join("|");
}

export function splitValidationResultsBySeverity(results: ValidationResult[]) {
  const blocking: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  for (const result of results) {
    if (result.outcome !== VALIDATION_OUTCOME.FAILED) {
      continue;
    }

    if (result.severity === "error") {
      blocking.push(result);
    } else {
      warnings.push(result);
    }
  }

  return { blocking, warnings };
}

export function buildPhotoValidationMap<
  T extends {
    id: string;
    orderIndex: number;
    file: { name: string };
  },
>(photos: T[], results: ValidationResult[]) {
  const map = new Map<string, ValidationResult[]>();

  for (const photo of photos) {
    const unique = new Map<string, ValidationResult>();

    for (const result of results) {
      if (result.isGeneral) {
        continue;
      }

      const matchesOrder =
        result.orderIndex !== undefined &&
        result.orderIndex === photo.orderIndex;
      const matchesFileName = result.fileName === photo.file.name;

      if (!matchesOrder && !matchesFileName) {
        continue;
      }

      unique.set(createValidationResultKey(result), result);
    }

    map.set(photo.id, Array.from(unique.values()));
  }

  return map;
}

export async function runClientValidation(
  rules: ValidationRule[],
  inputs: ValidationInput[],
) {
  return await clientRuntime.runPromise(
    Effect.gen(function* () {
      const engine = yield* ValidationEngine;
      return yield* engine.runValidations(rules, inputs);
    }),
  );
}
