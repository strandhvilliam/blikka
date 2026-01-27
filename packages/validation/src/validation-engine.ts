import { Effect } from "effect";
import { SingleValidationsService } from "./single-validations-service";
import { RULE_KEYS } from "./constants";
import { type ValidationRule, type ValidationInput, ValidationFailure } from "./types";
import { GroupedValidationsService } from "./grouped-validations-service";
import {
  createFailureResult,
  createPassedResult,
  createSkippedResult,
  parseRuleParams,
} from "./utils";

export class ValidationEngine extends Effect.Service<ValidationEngine>()(
  "@blikka/packages/validation/ValidationEngine",
  {
    dependencies: [
      SingleValidationsService.Default,
      GroupedValidationsService.Default,
    ],
    effect: Effect.gen(function*() {
      const singleValidationService = yield* SingleValidationsService;
      const multipleValidationService = yield* GroupedValidationsService;

      const executeRule = (rule: ValidationRule, inputs: ValidationInput[]) =>
        Effect.gen(function*() {
          switch (rule.ruleKey) {
            case RULE_KEYS.MAX_FILE_SIZE: {
              const params = yield* parseRuleParams(rule.ruleKey, rule.params);
              const results = yield* Effect.forEach(inputs, (input) =>
                singleValidationService
                  .validateMaxFileSize(params.max_file_size, input)
                  .pipe(
                    Effect.flatMap(() => createPassedResult(rule, input)),
                    Effect.catchTag("ValidationFailure", (error) =>
                      createFailureResult(rule, error, input),
                    ),
                  ),
              );
              return results;
            }
            case RULE_KEYS.ALLOWED_FILE_TYPES: {
              const params = yield* parseRuleParams(rule.ruleKey, rule.params);
              const results = yield* Effect.forEach(inputs, (input) =>
                singleValidationService
                  .validateAllowedFileTypes(params.allowed_file_types, input)
                  .pipe(
                    Effect.flatMap(() => createPassedResult(rule, input)),
                    Effect.catchTag("ValidationFailure", (error) =>
                      createFailureResult(rule, error, input),
                    ),
                    Effect.catchTag("ValidationSkipped", (error) =>
                      createSkippedResult(rule, error, input),
                    ),
                  ),
              );
              return results;
            }
            case RULE_KEYS.WITHIN_TIMERANGE: {

              const params = yield* parseRuleParams(rule.ruleKey, rule.params);

              const results = yield* Effect.forEach(inputs, (input) =>
                singleValidationService
                  .validateTimeframe(params.within_timerange, input)
                  .pipe(
                    Effect.flatMap(() => createPassedResult(rule, input)),
                    Effect.catchTag("ValidationFailure", (error) =>
                      createFailureResult(rule, error, input),
                    ),
                    Effect.catchTag("ValidationSkipped", (error) =>
                      createSkippedResult(rule, error, input),
                    ),
                  ),
              );
              return results;
            }
            case RULE_KEYS.STRICT_TIMESTAMP_ORDERING: {
              const params = yield* parseRuleParams(rule.ruleKey, rule.params);
              const results = yield* multipleValidationService
                .validateStrictTimestampOrdering(
                  params.strict_timestamp_ordering,
                  inputs,
                )
                .pipe(
                  Effect.flatMap(() => createPassedResult(rule)),
                  Effect.catchTag("ValidationFailure", (error) =>
                    createFailureResult(rule, error),
                  ),
                  Effect.catchTag("ValidationSkipped", (error) =>
                    createSkippedResult(rule, error),
                  ),
                );
              return [results];
            }
            case RULE_KEYS.SAME_DEVICE: {
              const params = yield* parseRuleParams(rule.ruleKey, rule.params);
              const results = yield* multipleValidationService
                .validateSameDevice(params.same_device, inputs)
                .pipe(
                  Effect.flatMap(() => createPassedResult(rule)),
                  Effect.catchTag("ValidationFailure", (error) =>
                    createFailureResult(rule, error),
                  ),
                  Effect.catchTag("ValidationSkipped", (error) =>
                    createSkippedResult(rule, error),
                  ),
                );
              return [results];
            }
            case RULE_KEYS.MODIFIED: {
              const params = yield* parseRuleParams(rule.ruleKey, rule.params);
              const results = yield* Effect.forEach(inputs, (input) =>
                singleValidationService
                  .validateModified(params.modified, input)
                  .pipe(
                    Effect.flatMap(() => createPassedResult(rule, input)),
                    Effect.catchTag("ValidationFailure", (error) =>
                      createFailureResult(rule, error, input),
                    ),
                  ),
              );
              return results;
            }
            default: {
              return yield* new ValidationFailure({
                ruleKey: rule.ruleKey,
                message: "Rule not found",
              });
            }
          }
        });

      const runValidations = (
        rules: ValidationRule[],
        inputs: ValidationInput[],
      ) =>
        Effect.gen(function*() {
          const results = yield* Effect.forEach(rules, (rule) =>
            Effect.try(() => executeRule(rule, inputs)).pipe(Effect.flatten),
          );
          return results.flat();
        });

      return {
        runValidations,
      };
    }),
  },
) {
}
