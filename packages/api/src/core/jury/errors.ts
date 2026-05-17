import { Schema } from "effect"
import type { ApiErrorCode } from "../errors"

export class JuryApiError extends Schema.TaggedErrorClass<JuryApiError>()(
  "@blikka/api/jury-api-error",
  {
    message: Schema.String,
    code: Schema.optional(
      Schema.Literals([
        "BAD_REQUEST",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "PRECONDITION_FAILED",
        "INTERNAL_SERVER_ERROR",
      ]),
    ),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type JuryApiErrorCode = ApiErrorCode;
