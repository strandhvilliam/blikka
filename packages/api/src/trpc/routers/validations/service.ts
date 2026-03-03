import { Config, Effect, Option, Schema } from "effect"
import { type RuleConfig, type Submission, Database } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import {
  ValidationEngine,
  ValidationInputSchema,
  ValidationRuleSchema,
  RuleKeySchema,
  type ValidationResult,
} from "@blikka/validation"
import { ValidationsApiError } from "./schemas"

export class ValidationsApiService extends Effect.Service<ValidationsApiService>()(
  "@blikka/api/validations-api-service",
  {
    accessors: true,
    dependencies: [Database.Default, S3Service.Default, ValidationEngine.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service
      const validator = yield* ValidationEngine

      const runValidations = Effect.fn("ValidationsApiService.runValidations")(function* ({
        domain,
        reference,
      }: {
        domain: string
        reference: string
      }) {
        const submissionsBucketName = yield* Config.string("NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME")

        const participant = yield* db.participantsQueries.getParticipantByReference({
          reference,
          domain,
        })

        if (Option.isNone(participant)) {
          return yield* Effect.fail(
            new ValidationsApiError({
              message: "Participant not found",
            })
          )
        }

        const rules = yield* db.rulesQueries.getRulesByDomain({
          domain,
        })

        const validationInputs = yield* Effect.forEach(
          participant.value.submissions,
          (submission: Submission & { topic: { orderIndex: number } }) =>
            Effect.gen(function* () {
              let fileSize = submission.size ?? 0
              let mimeType = submission.mimeType ?? "image/jpeg"

              if (!submission.size || !submission.mimeType) {
                const head = yield* s3
                  .getHead(submissionsBucketName, submission.key)
                  .pipe(Effect.catchAll(() => Effect.succeed(null)))
                if (head) {
                  fileSize = head.ContentLength ?? fileSize
                  mimeType = head.ContentType ?? mimeType
                }
              }

              const validationInput = ValidationInputSchema.make({
                exif: (submission.exif as Record<string, unknown>) ?? {},
                fileName: submission.key,
                fileSize,
                mimeType,
                orderIndex: submission.topic.orderIndex,
              })
              return validationInput
            }),
          { concurrency: "unbounded" }
        )

        const validationRules = yield* Effect.forEach(
          rules,
          (rule: RuleConfig) =>
            Effect.gen(function* () {
              const validationRuleKey = yield* Schema.decodeUnknown(RuleKeySchema)(rule.ruleKey)
              const ruleKeyStr = validationRuleKey as string
              const parsed = yield* Schema.decodeUnknown(ValidationRuleSchema(validationRuleKey))({
                ruleKey: validationRuleKey,
                enabled: rule.enabled,
                severity: rule.severity,
                params: { [ruleKeyStr]: rule.params },
              })
              return parsed
            }),
          { concurrency: "unbounded" }
        )

        const validationResults = yield* validator.runValidations(validationRules, validationInputs)

        yield* db.validationsQueries.clearAllValidationResults({
          participantId: participant.value.id,
        })

        const dbValidationResults = validationResults.map((result: ValidationResult) => ({
          outcome: result.outcome,
          ruleKey: result.ruleKey,
          message: result.message,
          severity: result.severity,
          fileName: result.fileName ?? null,
          overruled: false,
        }))

        yield* db.validationsQueries.createMultipleValidationResults({
          data: dbValidationResults,
          domain,
          reference,
        })

        return {
          success: true,
          resultsCount: validationResults.length,
        }
      })

      const createParticipantVerification = Effect.fn(
        "ValidationsApiService.createParticipantVerification"
      )(function* ({
        participantId,
        staffId,
        notes,
      }: {
        participantId: number
        staffId: string
        notes?: string
      }) {
        const verification = yield* db.validationsQueries.createParticipantVerification({
          data: {
            participantId,
            staffId,
            notes: notes ?? null,
          },
        })

        yield* db.participantsQueries.updateParticipantById({
          id: participantId,
          data: {
            status: "verified",
          },
        })

        return { id: verification.id }
      })

      const updateValidationResult = Effect.fn(
        "ValidationsApiService.updateValidationResult"
      )(function* ({
        id,
        data,
      }: {
        id: number
        data: {
          overruled: boolean
        }
      }) {
        return yield* db.validationsQueries.updateValidationResult({
          id,
          data,
        })
      })

      const getParticipantVerificationByReference = Effect.fn(
        "ValidationsApiService.getParticipantVerificationByReference"
      )(function* ({
        domain,
        reference,
      }: {
        domain: string
        reference: string
      }) {
        return yield* db.validationsQueries.getParticipantVerificationByReference({
          domain,
          reference,
        })
      })

      return {
        runValidations,
        createParticipantVerification,
        updateValidationResult,
        getParticipantVerificationByReference,
      } as const
    }),
  }
) {
}
