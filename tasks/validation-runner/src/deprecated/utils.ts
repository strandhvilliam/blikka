import { Schema } from "effect"

export class InvalidBodyError extends Schema.TaggedErrorClass<InvalidBodyError>()("InvalidBodyError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class InvalidDataFoundError extends Schema.TaggedErrorClass<InvalidDataFoundError>()(
  "InvalidDataFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export class InvalidValidationRuleError extends Schema.TaggedErrorClass<InvalidValidationRuleError>()(
  "InvalidValidationRuleError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}
