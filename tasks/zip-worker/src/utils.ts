import { Participant } from "@blikka/db"
import { Data, Effect, Schema } from "effect"
import { FinalizedEventSchema } from "@blikka/bus"

export class InvalidArgumentsError extends Data.TaggedError("InvalidArgumentsError")<{
  cause?: unknown
}> {}

export class DataNotFoundError extends Data.TaggedError("DataNotFoundError")<{
  domain: string
  reference: string
  key?: string
  message?: string
  cause?: unknown
}> {}

export class FailedToGenerateZipError extends Data.TaggedError("FailedToGenerateZipError")<{
  domain: string
  reference: string
  message?: string
  cause?: unknown
}> {}

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

export class InvalidBodyError extends Data.TaggedError("InvalidBodyError")<{
  message?: string
  cause?: unknown
}> {}

export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  message?: string
}> {}

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
