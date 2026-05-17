import { Context, Effect, Layer, Schema, Struct } from 'effect'
import { RULE_KEYS, VALIDATION_OUTCOME } from './constants'
import {
  type ValidationInput,
  type ValidationResult,
  type ValidationRule,
  ValidationFailure,
  ValidationSkipped,
  type RuleKey,
  RuleParamsSchema,
  ValidationResultSchema,
} from './schemas'
import {
  validateAllowedFileTypes,
  validateMaxFileSize,
  validateModified,
  validateSameDevice,
  validateStrictTimestampOrdering,
  validateTimeframe,
} from './validators'

export class ValidationParamError extends Schema.TaggedErrorClass<ValidationParamError>()(
  'ValidationParamError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ValidationEngineInternalError extends Schema.TaggedErrorClass<ValidationEngineInternalError>()(
  'ValidationEngineInternalError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type ValidationEngineError = ValidationParamError | ValidationEngineInternalError

export class ValidationEngine extends Context.Service<
  ValidationEngine,
  {
    /**
     * Runs all enabled validation rules against the given inputs.
     */
    readonly runValidations: (
      rules: ValidationRule[],
      inputs: ValidationInput[],
    ) => Effect.Effect<ValidationResult[], ValidationEngineError>
  }
>()('@blikka/packages/validation/ValidationEngine') {}

function createFailureResult(
  rule: ValidationRule,
  error: ValidationFailure,
  input?: ValidationInput,
): Effect.Effect<ValidationResult, Schema.SchemaError> {
  return ValidationResultSchema.makeEffect({
    outcome: VALIDATION_OUTCOME.FAILED,
    ruleKey: rule.ruleKey,
    message: error.message,
    severity: rule.severity,
    fileName: input?.fileName,
    orderIndex: input?.orderIndex,
    isGeneral: !input,
  })
}

function createSkippedResult(
  rule: ValidationRule,
  error: ValidationSkipped,
  input?: ValidationInput,
): Effect.Effect<ValidationResult, Schema.SchemaError> {
  return ValidationResultSchema.makeEffect({
    outcome: VALIDATION_OUTCOME.SKIPPED,
    ruleKey: rule.ruleKey,
    message: error.reason,
    severity: rule.severity,
    fileName: input?.fileName,
    orderIndex: input?.orderIndex,
    isGeneral: !input,
  })
}

function createPassedResult(
  rule: ValidationRule,
  input?: ValidationInput,
): Effect.Effect<ValidationResult, Schema.SchemaError> {
  return ValidationResultSchema.makeEffect({
    outcome: VALIDATION_OUTCOME.PASSED,
    ruleKey: rule.ruleKey,
    message: `${rule.ruleKey} validation passed`,
    severity: rule.severity,
    fileName: input?.fileName,
    orderIndex: input?.orderIndex,
    isGeneral: !input,
  })
}

const makeValidationEngine = Effect.sync(() => {
  const parseRuleParams = Effect.fnUntraced(function* <K extends RuleKey>(key: K, params: unknown) {
    return yield* Schema.decodeUnknownEffect(RuleParamsSchema.mapFields(Struct.pick([key])))(
      params,
    ).pipe(Effect.mapError((error) => new ValidationParamError({ message: error.message })))
  })

  const executeRule = Effect.fnUntraced(function* (
    rule: ValidationRule,
    inputs: ValidationInput[],
  ) {
    switch (rule.ruleKey) {
      case RULE_KEYS.MAX_FILE_SIZE: {
        const params = yield* parseRuleParams(rule.ruleKey, rule.params)
        const results = yield* Effect.forEach(inputs, (input) =>
          validateMaxFileSize(params.max_file_size, input).pipe(
            Effect.flatMap(() => createPassedResult(rule, input)),
            Effect.catchTag('ValidationFailure', (error) =>
              createFailureResult(rule, error, input),
            ),
          ),
        )
        return results
      }
      case RULE_KEYS.ALLOWED_FILE_TYPES: {
        const params = yield* parseRuleParams(rule.ruleKey, rule.params)
        const results = yield* Effect.forEach(inputs, (input) =>
          validateAllowedFileTypes(params.allowed_file_types, input).pipe(
            Effect.flatMap(() => createPassedResult(rule, input)),
            Effect.catchTag('ValidationFailure', (error) =>
              createFailureResult(rule, error, input),
            ),
            Effect.catchTag('ValidationSkipped', (error) =>
              createSkippedResult(rule, error, input),
            ),
          ),
        )
        return results
      }
      case RULE_KEYS.WITHIN_TIMERANGE: {
        const params = yield* parseRuleParams(rule.ruleKey, rule.params)

        const results = yield* Effect.forEach(inputs, (input) =>
          validateTimeframe(params.within_timerange, input).pipe(
            Effect.flatMap(() => createPassedResult(rule, input)),
            Effect.catchTag('ValidationFailure', (error) =>
              createFailureResult(rule, error, input),
            ),
            Effect.catchTag('ValidationSkipped', (error) =>
              createSkippedResult(rule, error, input),
            ),
          ),
        )
        return results
      }
      case RULE_KEYS.STRICT_TIMESTAMP_ORDERING: {
        const params = yield* parseRuleParams(rule.ruleKey, rule.params)
        const results = yield* validateStrictTimestampOrdering(
          params.strict_timestamp_ordering,
          inputs,
        ).pipe(
          Effect.flatMap(() => createPassedResult(rule)),
          Effect.catchTag('ValidationFailure', (error) => createFailureResult(rule, error)),
          Effect.catchTag('ValidationSkipped', (error) => createSkippedResult(rule, error)),
        )
        return [results]
      }
      case RULE_KEYS.SAME_DEVICE: {
        const params = yield* parseRuleParams(rule.ruleKey, rule.params)
        const results = yield* validateSameDevice(params.same_device, inputs).pipe(
          Effect.flatMap(() => createPassedResult(rule)),
          Effect.catchTag('ValidationFailure', (error) => createFailureResult(rule, error)),
          Effect.catchTag('ValidationSkipped', (error) => createSkippedResult(rule, error)),
        )
        return [results]
      }
      case RULE_KEYS.MODIFIED: {
        const params = yield* parseRuleParams(rule.ruleKey, rule.params)
        const results = yield* Effect.forEach(inputs, (input) =>
          validateModified(params.modified, input).pipe(
            Effect.flatMap(() => createPassedResult(rule, input)),
            Effect.catchTag('ValidationFailure', (error) =>
              createFailureResult(rule, error, input),
            ),
          ),
        )
        return results
      }
      default: {
        return yield* new ValidationEngineInternalError({
          message: `${rule.ruleKey} rule not found`,
        })
      }
    }
  })

  const runValidations = Effect.fn('ValidationEngine.runValidations')(
    function* (rules: ValidationRule[], inputs: ValidationInput[]) {
      const enabledRules = rules.filter((rule) => rule.enabled)

      const results = yield* Effect.forEach(enabledRules, (rule) => executeRule(rule, inputs)).pipe(
        Effect.catchTag(
          'SchemaError',
          (error) =>
            new ValidationEngineInternalError({
              message: error.message,
              cause: error,
            }),
        ),
      )
      return results.flat()
    },
    (effect, rules, inputs) =>
      Effect.annotateLogs(effect, {
        ruleCount: rules.length,
        inputCount: inputs.length,
      }),
  )

  return ValidationEngine.of({ runValidations })
})

export const ValidationEngineLayer = Layer.effect(ValidationEngine, makeValidationEngine)
