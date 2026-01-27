import { Data, Schema } from "effect";
import { RULE_KEYS } from "./constants";
import {
  RuleKeySchema,
  RuleParamsSchema,
  SeverityLevelSchema,
  ValidationInputSchema,
  ValidationResultSchema,
} from "./schemas";

export class ValidationFailure extends Schema.TaggedError<ValidationFailure>()("ValidationFailure", {
  ruleKey: RuleKeySchema,
  message: Schema.String,
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {
}

export class ValidationSkipped extends Schema.TaggedError<ValidationSkipped>()("ValidationSkipped", {
  ruleKey: RuleKeySchema,
  reason: Schema.String,
}) {
}

export type RuleKey = (typeof RULE_KEYS)[keyof typeof RULE_KEYS];

export type RuleParams = typeof RuleParamsSchema.Type;

export type SeverityLevel = typeof SeverityLevelSchema.Type;
export type ValidationInput = typeof ValidationInputSchema.Type;
export type ValidationResult = typeof ValidationResultSchema.Type;

export interface ValidationRule<K extends RuleKey = RuleKey> {
  ruleKey: K;
  enabled: boolean;
  severity: SeverityLevel;
  params: RuleParams[K];
}
