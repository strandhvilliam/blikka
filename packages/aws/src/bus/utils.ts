import { Effect, Schema } from "effect"

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

export const parseBusEvent = <S extends Schema.Top>(
  input: string,
  detailSchema: S
) =>
  Effect.gen(function* () {
    const json = yield* Effect.try({
      try: () => JSON.parse(input),
      catch: () => new JsonParseError({ message: "JSON parse error" }),
    })
    return yield* Schema.decodeUnknownEffect(detailSchema)(json.detail)
  }).pipe(
    Effect.withSpan("BlikkaBus.parseBusEvent"),
    Effect.catch((error) =>
      Effect.fail(new InvalidBusEventBodyError({
        message: `Failed to parse bus event: ${error.message}`,
        cause: error,
      }))
    )
  )
