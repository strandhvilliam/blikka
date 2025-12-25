import { Data, Effect, Schema } from "effect"
import { EventBusDetailTypes, FinalizedEventSchema } from "@blikka/bus"
import { RuleKeySchema, ValidationRule, ValidationRuleSchema } from "@vimmer/validation"
import { RuleConfig } from "@blikka/db"
import { EventBridgeEvent } from "@effect-aws/lambda"

export class InvalidBodyError extends Schema.TaggedError<InvalidBodyError>()("InvalidBodyError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class JsonParseError extends Schema.TaggedError<JsonParseError>()("JsonParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class InvalidDataFoundError extends Schema.TaggedError<InvalidDataFoundError>()(
  "InvalidDataFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class InvalidValidationRuleError extends Schema.TaggedError<InvalidValidationRuleError>()(
  "InvalidValidationRuleError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}
