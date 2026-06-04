import { Schema } from 'effect'
import { defineScript, lua } from 'upstash-lua'

/**
 * Atomically sets `validated` + `validationDecision` for the current upload session.
 * Part of flagged verification flow (`@blikka/uploads/flagged-verification-flow`).
 *
 * Returns: UPDATED | STALE_SESSION | NOT_FINALIZED | ALREADY_VALIDATED | MISSING_DATA
 */
export const updateValidationDecisionScript = defineScript({
  name: 'updateValidationDecision',
  keys: {
    key: Schema.toStandardSchemaV1(Schema.String),
  },
  args: {
    uploadSessionId: Schema.toStandardSchemaV1(Schema.String),
    validationDecision: Schema.toStandardSchemaV1(Schema.Literals(['passed', 'flagged'])),
    validatedAt: Schema.toStandardSchemaV1(Schema.String),
  },
  lua: ({ KEYS, ARGV }) => lua`
    local key = ${KEYS.key}
    local uploadSessionId = ${ARGV.uploadSessionId}
    local validationDecision = ${ARGV.validationDecision}
    local validatedAt = ${ARGV.validatedAt}

    local currentUploadSessionId = redis.call("HGET", key, "uploadSessionId")

    if not currentUploadSessionId then
      return "MISSING_DATA"
    end

    if currentUploadSessionId ~= uploadSessionId then
      return "STALE_SESSION"
    end

    local finalized = redis.call("HGET", key, "finalized")

    if finalized ~= "true" then
      return "NOT_FINALIZED"
    end

    if redis.call("HGET", key, "validated") == "true" then
      return "ALREADY_VALIDATED"
    end

    redis.call(
      "HSET",
      key,
      "validated",
      "true",
      "validationDecision",
      validationDecision,
      "validatedAt",
      validatedAt
    )

    return "UPDATED"
  `,
  returns: Schema.toStandardSchemaV1(Schema.String),
})
