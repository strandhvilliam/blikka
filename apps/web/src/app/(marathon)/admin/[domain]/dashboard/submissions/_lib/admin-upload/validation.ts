import { Effect } from "effect"
import type { RuleConfig } from "@blikka/db"
import { ValidationEngine, type ValidationInput, type ValidationResult } from "@blikka/validation"
import {
  hasBlockingValidationErrors,
  mapRuleConfigsToValidationRules,
  prepareValidationRules,
} from "~/lib/validation"
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

  const program = Effect.gen(function* () {
    const engine = yield* ValidationEngine
    return yield* engine.runValidations(rules, validationInputs)
  })
  return Effect.runPromise(program)
}
