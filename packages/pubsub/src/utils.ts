import { Schema } from "effect"
export class PubSubError extends Schema.TaggedErrorClass<PubSubError>()("PubSubError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class ChannelParseError extends Schema.TaggedErrorClass<ChannelParseError>()("ChannelParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}
