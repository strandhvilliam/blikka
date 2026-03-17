import {
  RULE_KEYS,
  IMAGE_EXTENSION_TO_MIME_TYPE,
  VALIDATION_OUTCOME,
} from "../constants";
import type {
  RuleParams,
  ValidationFunction,
  ValidationInput,
  ValidationResult,
} from "../types";
import { attachFileName, createValidationResult } from "../utils";
import {
  normalizeAllowedFileTypes,
  normalizeImageExtensionAlias,
} from "../../src/utils";

function getExtensionFromFilename(
  filename: string,
): keyof typeof IMAGE_EXTENSION_TO_MIME_TYPE | null {
  const match = filename.match(/\.([^.]+)$/);
  const extension = match
    ? normalizeImageExtensionAlias(match[1]?.replace(/^\./, "") ?? "")
    : null;
  return extension as keyof typeof IMAGE_EXTENSION_TO_MIME_TYPE | null;
}

function checkIfValidExtension(
  rule: RuleParams["allowed_file_types"],
  input: ValidationInput,
): ValidationResult {
  const extension = getExtensionFromFilename(input.fileName);
  const parsedAllowedFileTypes = normalizeAllowedFileTypes(
    rule.allowedFileTypes,
  );

  if (!extension) {
    return createValidationResult(
      VALIDATION_OUTCOME.SKIPPED,
      RULE_KEYS.ALLOWED_FILE_TYPES,
      "Unable to determine file extension",
    );
  }

  if (!parsedAllowedFileTypes.includes(extension)) {
    return createValidationResult(
      VALIDATION_OUTCOME.FAILED,
      RULE_KEYS.ALLOWED_FILE_TYPES,
      `Invalid file extension: ${extension} (allowed: ${parsedAllowedFileTypes.join(", ")})`,
    );
  }

  return createValidationResult(
    VALIDATION_OUTCOME.PASSED,
    RULE_KEYS.ALLOWED_FILE_TYPES,
    "Valid file extension",
  );
}

function checkIfValidMimeType(
  rule: RuleParams["allowed_file_types"],
  input: ValidationInput,
): ValidationResult {
  const filteredMimeTypes = Object.entries(IMAGE_EXTENSION_TO_MIME_TYPE).filter(
    ([key, _]) => rule.allowedFileTypes.includes(key),
  );

  if (filteredMimeTypes.length === 0) {
    return createValidationResult(
      VALIDATION_OUTCOME.FAILED,
      RULE_KEYS.ALLOWED_FILE_TYPES,
      `Invalid mime type: ${input.mimeType} (allowed: ${filteredMimeTypes.map(([key]) => key).join(", ")})`,
    );
  }

  const isValidMimeType = filteredMimeTypes.some(
    ([_, value]) => value === input.mimeType,
  );

  if (!isValidMimeType) {
    return createValidationResult(
      VALIDATION_OUTCOME.FAILED,
      RULE_KEYS.ALLOWED_FILE_TYPES,
      `Invalid file mime type: ${input.mimeType} (allowed: ${filteredMimeTypes.map(([key]) => key).join(", ")})`,
    );
  }

  return createValidationResult(
    VALIDATION_OUTCOME.PASSED,
    RULE_KEYS.ALLOWED_FILE_TYPES,
    "Valid mime type",
  );
}

export const validate: ValidationFunction<
  typeof RULE_KEYS.ALLOWED_FILE_TYPES
> = (rule, inputs) => {
  return inputs.flatMap((input) => [
    attachFileName(checkIfValidExtension(rule, input), input),
    attachFileName(checkIfValidMimeType(rule, input), input),
  ]);
};
