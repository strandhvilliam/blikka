import { assert, describe, it } from '@effect/vitest'
import { RULE_KEYS, VALIDATION_OUTCOME, type ValidationResult } from '@blikka/validation'

import { getValidationDecision } from './validation-decision'

const makeResult = (outcome: ValidationResult['outcome'], severity: ValidationResult['severity']) =>
  ({
    outcome,
    severity,
    ruleKey: RULE_KEYS.MAX_FILE_SIZE,
    message: outcome,
    fileName: 'photo.jpg',
    orderIndex: 0,
    isGeneral: false,
  }) satisfies ValidationResult

describe('getValidationDecision', () => {
  it('passes when all results passed', () => {
    assert.strictEqual(
      getValidationDecision({
        results: [makeResult(VALIDATION_OUTCOME.PASSED, 'error')],
        missingExifOrderIndexes: [],
      }),
      'passed',
    )
  })

  it('flags failed warnings', () => {
    assert.strictEqual(
      getValidationDecision({
        results: [makeResult(VALIDATION_OUTCOME.FAILED, 'warning')],
        missingExifOrderIndexes: [],
      }),
      'flagged',
    )
  })

  it('flags failed errors', () => {
    assert.strictEqual(
      getValidationDecision({
        results: [makeResult(VALIDATION_OUTCOME.FAILED, 'error')],
        missingExifOrderIndexes: [],
      }),
      'flagged',
    )
  })

  it('flags skipped results', () => {
    assert.strictEqual(
      getValidationDecision({
        results: [makeResult(VALIDATION_OUTCOME.SKIPPED, 'warning')],
        missingExifOrderIndexes: [],
      }),
      'flagged',
    )
  })

  it('flags missing exif', () => {
    assert.strictEqual(
      getValidationDecision({
        results: [makeResult(VALIDATION_OUTCOME.PASSED, 'error')],
        missingExifOrderIndexes: [0],
      }),
      'flagged',
    )
  })

  it('passes when no rules produced results', () => {
    assert.strictEqual(
      getValidationDecision({
        results: [],
        missingExifOrderIndexes: [],
      }),
      'passed',
    )
  })
})
