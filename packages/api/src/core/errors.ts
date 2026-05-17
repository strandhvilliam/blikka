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

export function isCodedApiError(error: unknown): error is { code: ApiErrorCode } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof Reflect.get(error, "code") === "string" &&
    apiErrorCodes.includes(Reflect.get(error, "code") as ApiErrorCode)
  )
}
