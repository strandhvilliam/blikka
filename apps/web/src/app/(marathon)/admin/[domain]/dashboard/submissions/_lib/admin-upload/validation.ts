import type { RuleConfig } from "@blikka/db"
import { type ValidationInput, type ValidationResult } from "@blikka/validation"
import {
  hasBlockingValidationErrors,
  mapRuleConfigsToValidationRules,
  prepareValidationRules,
  runClientValidation,
} from "@/lib/validation"
import type { AdminSelectedPhoto } from "./types"

export { hasBlockingValidationErrors }

interface RunAdminPhotoValidationInput {
  photos: AdminSelectedPhoto[]
  ruleConfigs: RuleConfig[]
  marathonStartDate?: string | Date | null
  marathonEndDate?: string | Date | null
}

export async function runAdminPhotoValidation({
  photos,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: RunAdminPhotoValidationInput): Promise<ValidationResult[]> {
  if (photos.length === 0) {
    return []
  }

  const rules = prepareValidationRules(
    mapRuleConfigsToValidationRules(ruleConfigs),
    { start: marathonStartDate, end: marathonEndDate },
  )

  if (rules.length === 0) {
    return []
  }

  const validationInputs: ValidationInput[] = photos.map((photo) => ({
    exif: photo.exif,
    fileName: photo.file.name,
    fileSize: photo.file.size,
    orderIndex: photo.orderIndex,
    mimeType: photo.file.type,
  }))

  try {
    const results = await runClientValidation(rules, validationInputs)
    return results
  } catch (error) {
    throw new Error(`Failed to validate selected images: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}


