import { Effect, Option, Schema } from "effect"

/**
 * HTTP-style codes used to translate API errors at the transport boundary
 * (e.g. tRPC). New code should prefer raising one of the tagged errors defined
 * below; this list is kept for `mapTokenError`-style helpers that still need to
 * pick between status codes by string.
 */
export const apiErrorCodes = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "INTERNAL_SERVER_ERROR",
] as const

export type ApiErrorCode = (typeof apiErrorCodes)[number]

/**
 * Schema used for the optional `identifier` field on structured API errors.
 * Accepts a small JSON-ish record so the transport layer can render a useful
 * message and so tests can pattern-match without parsing free-form strings.
 */
const IdentifierSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Number, Schema.Null]),
)

/**
 * The resource (`Marathon`, `CompetitionClass`, ...) cannot be located using
 * the supplied identifier(s).
 *
 * Maps to HTTP 404 / tRPC `NOT_FOUND`.
 */
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "@blikka/api/NotFoundError",
  {
    resource: Schema.String,
    identifier: Schema.optional(IdentifierSchema),
    cause: Schema.optional(Schema.Unknown),
  },
) {
  override get message(): string {
    if (this.identifier) {
      const pairs = Object.entries(this.identifier)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(", ")
      return `${this.resource} not found (${pairs})`
    }
    return `${this.resource} not found`
  }
}

/**
 * The request is well-formed but the supplied data violates a domain rule
 * (invalid combination of fields, out-of-range value, etc.).
 *
 * Maps to HTTP 400 / tRPC `BAD_REQUEST`.
 */
export class BadRequestError extends Schema.TaggedErrorClass<BadRequestError>()(
  "@blikka/api/BadRequestError",
  {
    message: Schema.String,
    details: Schema.optional(IdentifierSchema),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * The caller is not authenticated (no credentials, expired token, invalid
 * token, etc.).
 *
 * Maps to HTTP 401 / tRPC `UNAUTHORIZED`.
 */
export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
  "@blikka/api/UnauthorizedError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * The caller is authenticated but not permitted to perform the action on the
 * targeted resource.
 *
 * Maps to HTTP 403 / tRPC `FORBIDDEN`.
 */
export class ForbiddenError extends Schema.TaggedErrorClass<ForbiddenError>()(
  "@blikka/api/ForbiddenError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * The action conflicts with the current state of the resource (e.g. duplicate
 * key, attempted state transition that has already happened).
 *
 * Maps to HTTP 409 / tRPC `CONFLICT`.
 */
export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  "@blikka/api/ConflictError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * The system state does not satisfy a required precondition for this action
 * (e.g. resource exists but is in a non-actionable status).
 *
 * Maps to HTTP 412 / tRPC `PRECONDITION_FAILED`.
 */
export class PreconditionFailedError extends Schema.TaggedErrorClass<PreconditionFailedError>()(
  "@blikka/api/PreconditionFailedError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * An unexpected internal failure that does not map to any other structured
 * error. Prefer letting more specific errors (`DbError`, `S3ClientError`, etc.)
 * flow through and translate them at the transport boundary; use this only when
 * the failure originates inside the API package itself.
 *
 * Maps to HTTP 500 / tRPC `INTERNAL_SERVER_ERROR`.
 */
export class InternalApiError extends Schema.TaggedErrorClass<InternalApiError>()(
  "@blikka/api/InternalApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * Union of every structured API error that the transport layer knows how to
 * translate into an HTTP / tRPC response.
 */
export type ApiError =
  | NotFoundError
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | ConflictError
  | PreconditionFailedError
  | InternalApiError

/**
 * Lifts an `Effect<Option<A>, ...>` into an `Effect<A, NotFoundError | ...>`,
 * failing with a {@link NotFoundError} when the option is `None`.
 *
 * Replaces the very common pattern:
 *
 * ```ts
 * const value = yield* repo.getX(...)
 * if (Option.isNone(value)) {
 *   return yield* Effect.fail(new SomeApiError({ message: "X not found" }))
 * }
 * const x = value.value
 * ```
 *
 * with:
 *
 * ```ts
 * const x = yield* repo.getX(...).pipe(failNotFoundIfNone("X", { id }))
 * ```
 */
export const failNotFoundIfNone =
  (resource: string, identifier?: Record<string, string | number | null>) =>
  <A, E, R>(self: Effect.Effect<Option.Option<A>, E, R>): Effect.Effect<A, E | NotFoundError, R> =>
    Effect.flatMap(
      self,
      Option.match({
        onNone: () => Effect.fail(new NotFoundError({ resource, identifier })),
        onSome: Effect.succeed,
      }),
    )
