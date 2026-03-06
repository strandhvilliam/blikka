import { Effect, Schema } from "effect"


const RealtimeChannelEnv = Schema.Literals(["prod", "dev", "staging"])
const RealtimeChannelType = Schema.Literals(["upload-flow", "logger"])

const RealtimeChannelString = Schema.TemplateLiteral([
  RealtimeChannelEnv,
  Schema.Literal(":"),
  RealtimeChannelType,
  Schema.Literal(":"),
  Schema.String
])

type RealtimeChannelEnv = Schema.Schema.Type<typeof RealtimeChannelEnv>
type RealtimeChannelType = Schema.Schema.Type<typeof RealtimeChannelType>
type RealtimeChannelString = Schema.Schema.Type<typeof RealtimeChannelString>


export class RealtimeError extends Schema.TaggedErrorClass<RealtimeError>()("RealtimeError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}


export class RealtimeChannel extends Schema.Class<RealtimeChannel>("RealtimeChannel")({
  environment: RealtimeChannelEnv,
  type: RealtimeChannelType,
  identifier: Schema.String,
}) {
  static stringify = Effect.fnUntraced(function* (channel: RealtimeChannel) {
    return yield* Schema.encodeEffect(RealtimeChannelString)(
      `${channel.environment}:${channel.type}:${channel.identifier}`
    ).pipe(Effect.mapError((error) => new RealtimeError({ message: error.message, cause: error })))
  })
  static fromString = Effect.fnUntraced(function* (str: RealtimeChannelString) {
    const parts = str.split(":")
    if (parts.length !== 3) {
      return yield* new RealtimeError({ message: "Invalid realtime channel string" })
    }
    const [environment, type, identifier] = parts
    return yield* Schema.decodeUnknownEffect(RealtimeChannel)({
      environment,
      type,
      identifier,
    }).pipe(Effect.mapError((error) => new RealtimeError({ message: error.message, cause: error })))
  })

  static parse = Effect.fnUntraced(function* (str: string) {
    return yield* Schema.decodeUnknownEffect(RealtimeChannelString)(str)
      .pipe(Effect.mapError((error) => new RealtimeError({ message: 'Failed to parse realtime channel string', cause: error })))
      .pipe(Effect.andThen(RealtimeChannel.fromString))
  })
}


export class RealtimeMessage extends Schema.Class<RealtimeMessage>("RealtimeMessage")({
  channel: RealtimeChannelString,
  payload: Schema.Unknown,
  timestamp: Schema.Number,
  messageId: Schema.String,
  pattern: Schema.optional(Schema.String),
}) {
  static create = Effect.fnUntraced(function* <T>(
    channel: RealtimeChannel,
    payload: T,
    schema?: Schema.Codec<T, any, any, never>
  ) {
    const channelString = yield* RealtimeChannel.stringify(channel)
    const encodedPayload = schema ? yield* Schema.encodeEffect(schema)(payload) : payload
    return yield* Schema.decodeUnknownEffect(RealtimeMessage)({
      channel: channelString,
      payload: encodedPayload,
      timestamp: Date.now(),
      messageId: crypto.randomUUID(),
    })
      .pipe(Effect.mapError((error) => new RealtimeError({ message: 'Failed to create realtime message', cause: error })))
  })

  static jsonStringify = Effect.fnUntraced(function* (message: RealtimeMessage) {
    return yield* Effect.try({
      try: () => JSON.stringify(message),
      catch: (err) => new RealtimeError({ message: "Failed to stringify realtime message", cause: err }),
    }).pipe(Effect.mapError((error) => new RealtimeError({ message: 'Failed to stringify realtime message', cause: error })))
  })
}
