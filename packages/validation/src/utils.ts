import { RuleParamsSchema, ValidationResultSchema } from "./schemas";
import { Effect, Schema, Option } from "effect";
import {
  type RuleKey,
  ValidationFailure,
  type ValidationInput,
  type ValidationResult,
  type ValidationRule,
  ValidationSkipped,
} from "./types";
import { VALIDATION_OUTCOME } from "./constants";

export class ValidationParamError extends Schema.TaggedError<ValidationParamError>()(
  "ValidationParamError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {
}

export const parseRuleParams = <K extends RuleKey>(key: K, params: unknown) =>
  Effect.gen(function*() {
    return yield* Schema.decodeUnknown(RuleParamsSchema.pick(key))(params).pipe(
      Effect.mapError(
        (error) => new ValidationParamError({ message: error.message }),
      ),
    );
  });

export const getTimestamp = (
  exif: Record<string, unknown>,
): Option.Option<Date> =>
  Option.fromNullable(
    exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.CreateDate,
  ).pipe(
    Option.filter((timestamp) => typeof timestamp === "string"),
    Option.flatMap((timestamp) => {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? Option.none() : Option.some(date);
    }),
  );

export const getDeviceIdentifier = (
  exif: Record<string, unknown>,
): Option.Option<string> =>
  Option.fromNullable(exif.Model).pipe(
    Option.filter((m): m is string => typeof m === "string"),
    Option.map((model) => {
      if (exif.Make && typeof exif.Make === "string") {
        const serial =
          exif.SerialNumber && typeof exif.SerialNumber === "string"
            ? `-${exif.SerialNumber}`
            : "";
        return `${exif.Make}-${model}${serial}`;
      }
      return model;
    }),
  );

export const getExtensionFromFilename = (
  filename: string,
): Option.Option<string> => {
  const match = filename.match(/\.([^.]+)$/);
  return Option.fromNullable(match?.[1]).pipe(
    Option.map((extension) => extension.toLowerCase().replace(/^\./, "")),
  );
};

export const createFailureResult = (
  rule: ValidationRule,
  error: ValidationFailure,
  input?: ValidationInput,
): Effect.Effect<ValidationResult> =>
  Effect.succeed(
    ValidationResultSchema.make({
      outcome: VALIDATION_OUTCOME.FAILED,
      ruleKey: rule.ruleKey,
      message: error.message,
      severity: rule.severity,
      fileName: input?.fileName,
      orderIndex: input?.orderIndex,
      isGeneral: !input,
    }),
  );

export const createSkippedResult = (
  rule: ValidationRule,
  error: ValidationSkipped,
  input?: ValidationInput,
): Effect.Effect<ValidationResult> =>
  Effect.succeed(
    ValidationResultSchema.make({
      outcome: VALIDATION_OUTCOME.SKIPPED,
      ruleKey: rule.ruleKey,
      message: error.reason,
      severity: rule.severity,
      fileName: input?.fileName,
      orderIndex: input?.orderIndex,
      isGeneral: !input,
    }),
  );

export const createPassedResult = (
  rule: ValidationRule,
  input?: ValidationInput,
): Effect.Effect<ValidationResult> =>
  Effect.succeed(
    ValidationResultSchema.make({
      outcome: VALIDATION_OUTCOME.PASSED,
      ruleKey: rule.ruleKey,
      message: `${rule.ruleKey} validation passed`,
      severity: rule.severity,
      fileName: input?.fileName,
      orderIndex: input?.orderIndex,
      isGeneral: !input,
    }),
  );
