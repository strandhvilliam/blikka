import { Participant } from "@blikka/db"
import { Schema } from "effect"

export class InvalidArgumentsError extends Schema.TaggedErrorClass<InvalidArgumentsError>()(
  "InvalidArgumentsError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class DataNotFoundError extends Schema.TaggedErrorClass<DataNotFoundError>()(
  "DataNotFoundError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    key: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class FailedToGenerateZipError extends Schema.TaggedErrorClass<FailedToGenerateZipError>()(
  "FailedToGenerateZipError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

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

