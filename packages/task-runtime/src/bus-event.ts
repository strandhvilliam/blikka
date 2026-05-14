import { Effect, Schema } from "effect";

import { parseJson } from "./sqs-message";

export class InvalidBusEventBodyError extends Schema.TaggedErrorClass<InvalidBusEventBodyError>()(
  "InvalidBusEventBodyError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const parseBusEvent = <S extends Schema.Top>(input: string, detailSchema: S) =>
  Effect.gen(function* () {
    const json = yield* parseJson(input);
    return yield* Schema.decodeUnknownEffect(detailSchema)((json as { detail: unknown }).detail);
  }).pipe(
    Effect.withSpan("TaskRuntime.parseBusEvent"),
    Effect.catch((error) =>
      Effect.fail(
        new InvalidBusEventBodyError({
          message: `Failed to parse bus event: ${error.message}`,
          cause: error,
        }),
      ),
    ),
  );
