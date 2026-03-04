import { Data, Effect, Schema } from "effect"
import { type EventBridgeEvent } from "@effect-aws/lambda"
import type { EventBusDetailTypes } from "./event-types"
import { FinalizedEventSchema } from "./schemas"

export class InvalidBusEventBodyError extends Schema.TaggedErrorClass<InvalidBusEventBodyError>()("InvalidBusEventBodyError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export const parseBusEvent = Effect.fn("BlikkaBus.parseBusEvent")(
  function* <
    TDetailType extends (typeof EventBusDetailTypes)[keyof typeof EventBusDetailTypes],
    TDetailSchema,
  >(input: string, detailSchema: Schema.Schema<TDetailSchema>) {
    const json = (yield* Effect.try({
      try: () => JSON.parse(input),
      catch: () => new JsonParseError({ message: "JSON parse error" }),
    })) as EventBridgeEvent<TDetailType, TDetailSchema>
    return yield* Schema.decodeUnknownEffect(detailSchema)(json.detail)
  },
  Effect.mapError(
    (error) =>
      new InvalidBusEventBodyError({
        message: `Failed to parse bus event: ${error.message}`,
        cause: error
      })
  )
)
