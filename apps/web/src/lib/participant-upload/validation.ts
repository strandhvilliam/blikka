import type { RuleConfig } from "@blikka/db";
import type { ValidationResult } from "@blikka/validation";
import {
  type ValidatablePhotoLike,
  buildValidationInputs,
  hasBlockingValidationErrors,
  mapRuleConfigsToValidationRules,
  prepareValidationRules,
  runClientValidation,
} from "../validation";

export { hasBlockingValidationErrors };

interface RunParticipantPhotoValidationInput<
  TPhoto extends ValidatablePhotoLike = ValidatablePhotoLike,
> {
  photos: TPhoto[];
  ruleConfigs: RuleConfig[];
  marathonStartDate?: string | Date | null;
  marathonEndDate?: string | Date | null;
}

export async function runParticipantPhotoValidation<
  TPhoto extends ValidatablePhotoLike,
>({
  photos,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: RunParticipantPhotoValidationInput<TPhoto>): Promise<ValidationResult[]> {
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
