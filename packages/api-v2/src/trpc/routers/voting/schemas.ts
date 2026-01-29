import { Schema } from "effect";

export class VotingApiError extends Schema.TaggedError<VotingApiError>()(
  "@blikka/api-v2/VotingApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const GetVotingSessionSchema = Schema.standardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  }),
);
