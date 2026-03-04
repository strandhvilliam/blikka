import { Effect, Schema } from "effect"
import { ChannelParseError } from "./utils"

const PubSubChannelEnvironment = Schema.Literals(["prod", "dev", "staging"])
const PubSubChannelType = Schema.Literals(["upload-flow", "logger"])

const PubSubChannelString = Schema.TemplateLiteral([
  PubSubChannelEnvironment,
  Schema.Literal(":"),
  PubSubChannelType,
  Schema.Literal(":"),
  Schema.String
])

type PubSubChannelEnvironment = Schema.Schema.Type<typeof PubSubChannelEnvironment>
type PubSubChannelType = Schema.Schema.Type<typeof PubSubChannelType>
type PubSubChannelString = Schema.Schema.Type<typeof PubSubChannelString>

export class PubSubChannel extends Schema.Class<PubSubChannel>("PubSubChannel")({
  environment: PubSubChannelEnvironment,
  type: PubSubChannelType,
  identifier: Schema.String,
}) {
  static toString = Effect.fnUntraced(function* (channel: PubSubChannel) {
    return yield* Schema.encodeEffect(PubSubChannelString)(
      `${channel.environment}:${channel.type}:${channel.identifier}`
    ).pipe(Effect.mapError((error) => new ChannelParseError({ message: error.message, cause: error })))
  })
  static fromString = Effect.fnUntraced(function* (str: PubSubChannelString) {
    const parts = str.split(":")
    if (parts.length !== 3) {
      return yield* new ChannelParseError({ message: "Invalid pubsub channel string" })
    }
    const [environment, type, identifier] = parts
    return yield* Schema.decodeUnknownEffect(PubSubChannel)({
      environment,
      type,
      identifier,
    }).pipe(Effect.mapError((error) => new ChannelParseError({ message: error.message, cause: error })))
  })

  static parse = Effect.fnUntraced(function* (str: string) {
    return yield* Schema.decodeUnknownEffect(PubSubChannelString)(str)
      .pipe(Effect.mapError((error) => new ChannelParseError({ message: error.message, cause: error })))
      .pipe(Effect.andThen(PubSubChannel.fromString))
  })
}

export class PubSubMessage extends Schema.Class<PubSubMessage>("PubSubMessage")({
  channel: PubSubChannelString,
  payload: Schema.Unknown,
  timestamp: Schema.Number,
  messageId: Schema.String,
  pattern: Schema.optional(Schema.String),
}) {
  static create = Effect.fnUntraced(function* <T>(
    channel: PubSubChannel,
    payload: T,
    schema?: Schema.Codec<T, any, any, never>
  ) {
    return yield* Schema.encodeUnknownEffect(PubSubMessage)({
      channel: yield* PubSubChannel.toString(channel),
      payload: schema ? yield* Schema.encodeEffect(schema)(payload) : payload,
      timestamp: Date.now(),
      messageId: crypto.randomUUID(),
    })
  })
}
