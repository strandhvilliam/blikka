import { Participant } from "@blikka/db"
import { Data, Effect, Schema } from "effect"
import { FinalizedEventSchema } from "@blikka/bus"

export class InvalidArgumentsError extends Schema.TaggedError<InvalidArgumentsError>()(
  "InvalidArgumentsError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class DataNotFoundError extends Schema.TaggedError<DataNotFoundError>()(
  "DataNotFoundError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    key: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class FailedToGenerateZipError extends Schema.TaggedError<FailedToGenerateZipError>()(
  "FailedToGenerateZipError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export function makeNewZipDto(domain: string, participant: Participant) {
  return {
    data: {
      marathonId: participant.marathonId,
      participantId: participant.id,
      key: `${domain}/${participant.reference}.zip`,
      exportType: "zip",
      progress: 100,
      status: "completed",
      errors: [],
    },
  }
}

export class InvalidBodyError extends Schema.TaggedError<InvalidBodyError>()("InvalidBodyError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class JsonParseError extends Schema.TaggedError<JsonParseError>()("JsonParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export const parseFinalizedEvent = Effect.fn("contactSheetGenerator.parseFinalizedEvent")(
  function* (input: string) {
    const json = yield* Effect.try({
      try: () => JSON.parse(input),
      catch: (unknown) => new JsonParseError({ message: "Failed to parse JSON" }),
    })
    const params = yield* Schema.decodeUnknown(FinalizedEventSchema)(json)
    return params
  },
  Effect.mapError(
    (error) =>
      new InvalidBodyError({
        message: "Failed to parse finalized event",
        cause: error,
      })
  )
)
