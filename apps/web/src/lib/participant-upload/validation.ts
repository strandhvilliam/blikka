import type { RuleConfig } from "@blikka/db";
import type { ValidationResult } from "@blikka/validation";
import {
  buildValidationInputs,
  hasBlockingValidationErrors,
  mapRuleConfigsToValidationRules,
  prepareValidationRules,
  runClientValidation,
} from "@/lib/validation";
import type { ParticipantSelectedPhoto } from "./types";

export { hasBlockingValidationErrors };

interface RunParticipantPhotoValidationInput {
  photos: ParticipantSelectedPhoto[];
  ruleConfigs: RuleConfig[];
  marathonStartDate?: string | Date | null;
  marathonEndDate?: string | Date | null;
}

export async function runParticipantPhotoValidation({
  photos,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: RunParticipantPhotoValidationInput): Promise<ValidationResult[]> {
  if (photos.length === 0) {
    return [];
  }

  const rules = prepareValidationRules(
    mapRuleConfigsToValidationRules(ruleConfigs),
    { start: marathonStartDate, end: marathonEndDate },
  );

  if (rules.length === 0) {
    return [];
  }

  try {
    return await runClientValidation(rules, buildValidationInputs(photos));
  } catch (error) {
    throw new Error(
      `Failed to validate selected images: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

