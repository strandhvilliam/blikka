import { Database } from "@blikka/db"
import type { DbError, RuleConfig } from "@blikka/db"
import { S3Service } from "@blikka/aws"
import {
  ExifKVRepository,
  ExifKVRepositoryError,
  UploadSessionRepository,
  UploadSessionRepositoryError,
} from "@blikka/kv-store"
import { type ExifState, type SubmissionState } from "@blikka/kv-store"
import {
  RuleKeySchema,
  ValidationEngine,
  ValidationInputSchema,
  ValidationRuleSchema,
  type ValidationEngineError,
} from "@blikka/validation"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { UploadsConfig } from "./config"

export class ValidationRunnerInvalidDataError extends Schema.TaggedErrorClass<ValidationRunnerInvalidDataError>()(
  "ValidationRunnerInvalidDataError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class InvalidValidationRuleError extends Schema.TaggedErrorClass<InvalidValidationRuleError>()(
  "InvalidValidationRuleError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type ValidationRunnerError =
  | ValidationRunnerInvalidDataError
  | InvalidValidationRuleError
  | UploadSessionRepositoryError
  | ExifKVRepositoryError
  | DbError
  | ValidationEngineError

export interface ValidateParticipantInput {
  readonly domain: string
  readonly reference: string
  readonly uploadSessionId: string
}

export interface ValidationRunnerShape {
  readonly execute: (input: ValidateParticipantInput) => Effect.Effect<void, ValidationRunnerError>
}

export class ValidationRunner extends Context.Service<ValidationRunner, ValidationRunnerShape>()(
  "@blikka/uploads/ValidationRunner",
) {}

const makeValidationRunner = Effect.gen(function* () {
  const db = yield* Database
  const s3 = yield* S3Service
  const uploadKv = yield* UploadSessionRepository
  const exifKv = yield* ExifKVRepository
  const config = yield* UploadsConfig
  const engine = yield* ValidationEngine

  const createValidationRules = Effect.fnUntraced(
    function* (rules: RuleConfig[]) {
      return yield* Effect.forEach(
        rules,
        (rule) =>
          Effect.gen(function* () {
            const validationRule = yield* Schema.decodeUnknownEffect(RuleKeySchema)(rule.ruleKey)
            return yield* Schema.decodeUnknownEffect(ValidationRuleSchema(validationRule))({
              ruleKey: validationRule,
              enabled: rule.enabled,
              severity: rule.severity,
              params: { [validationRule]: rule.params },
            })
          }),
        { concurrency: "unbounded" },
      )
    },
    Effect.mapError(
      (error) =>
        new InvalidValidationRuleError({
          message: error.message,
          cause: error,
        }),
    ),
  )

  const createValidationInputs = Effect.fnUntraced(
    function* (
      exifStates: { orderIndex: number; exif: ExifState }[],
      submissionStates: readonly SubmissionState[],
    ) {
      return yield* Effect.forEach(
        submissionStates,
        (submissionState) =>
          Effect.gen(function* () {
            const exifState = exifStates.find((e) => e.orderIndex === submissionState.orderIndex)
            const head = yield* s3.getHead(config.submissionsBucketName, submissionState.key)

            return ValidationInputSchema.make({
              exif: exifState?.exif ?? {},
              fileName: submissionState.key,
              mimeType: head.ContentType ?? "image/jpeg",
              fileSize: head.ContentLength ?? 0,
              orderIndex: submissionState.orderIndex,
            })
          }),
        { concurrency: 5 },
      )
    },
    Effect.mapError(
      (error) =>
        new ValidationRunnerInvalidDataError({
          message: error.message,
          cause: error,
        }),
    ),
  )

  const execute: ValidationRunnerShape["execute"] = Effect.fn("ValidationRunner.execute")(
    function* ({ domain, reference, uploadSessionId }: ValidateParticipantInput) {
      const participantState = yield* uploadKv.getParticipantState(domain, reference)

      if (Option.isNone(participantState)) {
        return yield* new ValidationRunnerInvalidDataError({
          message: "Participant state not found",
        })
      }

      if (!participantState.value.finalized) {
        yield* Effect.logWarning("Participant state not finalized, skipping validation")
        return
      }

      if (participantState.value.uploadSessionId !== uploadSessionId) {
        yield* Effect.logWarning("Dropping validation event for non-current upload session", {
          uploadSessionId,
        })
        return
      }

      if (participantState.value.validated) {
        yield* Effect.logWarning("Participant already validated, skipping")
        return
      }

      const rules = yield* db.rulesQueries.getRulesByDomain({ domain })
      const orderIndexes = [...participantState.value.orderIndexes]

      const [exifStates, submissionStates] = yield* Effect.all(
        [
          exifKv.getAllExifStates(domain, reference, orderIndexes),
          uploadKv.getAllSubmissionStates(domain, reference, orderIndexes),
        ],
        { concurrency: 2 },
      )

      if (submissionStates.length === 0) {
        return yield* new ValidationRunnerInvalidDataError({
          message: "No submission states found",
        })
      }

      if (submissionStates.length !== orderIndexes.length) {
        return yield* new ValidationRunnerInvalidDataError({
          message: `Submission states length mismatch: expected ${orderIndexes.length} but got ${submissionStates.length}`,
        })
      }

      const exifStatesByOrderIndex = new Set(exifStates.map((state) => state.orderIndex))
      const missingExifOrderIndexes = submissionStates
        .filter((state) => !exifStatesByOrderIndex.has(state.orderIndex))
        .map((state) => state.orderIndex)

      if (missingExifOrderIndexes.length > 0) {
        yield* Effect.logWarning(
          "Missing EXIF state during validation; continuing with empty EXIF data",
          { missingExifOrderIndexes },
        )
      }

      const validationInputs = yield* createValidationInputs(exifStates, submissionStates)
      const validationRules = yield* createValidationRules(rules)
      const validationResults = yield* engine.runValidations(validationRules, validationInputs)

      yield* db.validationsQueries.createMultipleValidationResults({
        data: validationResults,
        domain,
        reference,
      })

      yield* uploadKv.updateParticipantSession(domain, reference, {
        validated: true,
      })
    },
    (effect, input) => Effect.annotateLogs(effect, { ...input }),
  )

  return { execute } satisfies ValidationRunnerShape
})

export const ValidationRunnerLayer = Layer.effect(ValidationRunner, makeValidationRunner)
