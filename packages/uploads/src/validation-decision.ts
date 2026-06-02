import { VALIDATION_OUTCOME, type ValidationResult } from '@blikka/validation'

export type ValidationDecision = 'pending' | 'passed' | 'flagged'

export function getValidationDecision({
  results,
  missingExifOrderIndexes,
}: {
  results: readonly Pick<ValidationResult, 'outcome'>[]
  missingExifOrderIndexes: readonly number[]
}): Exclude<ValidationDecision, 'pending'> {
  if (missingExifOrderIndexes.length > 0) {
    return 'flagged'
  }

  if (results.some((result) => result.outcome !== VALIDATION_OUTCOME.PASSED)) {
    return 'flagged'
  }

  return 'passed'
}
