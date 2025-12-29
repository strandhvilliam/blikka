import { authProcedure, createTRPCRouter } from "../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../utils"
import { Config, Schema, Effect, Option } from "effect"
import { Database, DrizzleClient, type Submission, type RuleConfig } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import {
  ValidationEngine,
  ValidationInputSchema,
  ValidationRuleSchema,
  RuleKeySchema,
  type ValidationResult as ValidationEngineResult,
} from "@blikka/validation"
import { TRPCError } from "@trpc/server"

export const validationsRouter = createTRPCRouter({
  runValidations: authProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({
          domain: Schema.String,
          reference: Schema.String,
        })
      )
    )
    .mutation(
      trpcEffect(
        Effect.fn("ValidationsRouter.runValidations")(function* ({ input, ctx }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

          const db = yield* Database
          const s3 = yield* S3Service
          const validator = yield* ValidationEngine
          const submissionsBucketName = yield* Config.string("NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME")

          const participant = yield* db.participantsQueries.getParticipantByReference({
            reference: input.reference,
            domain: input.domain,
          })

          if (Option.isNone(participant)) {
            return yield* Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
                message: "Participant not found",
              })
            )
          }

          const rules = yield* db.rulesQueries.getRulesByDomain({
            domain: input.domain,
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
                const parsed = yield* Schema.decodeUnknown(ValidationRuleSchema(validationRuleKey))(
                  {
                    ruleKey: validationRuleKey,
                    enabled: rule.enabled,
                    severity: rule.severity,
                    params: { [ruleKeyStr]: rule.params },
                  }
                )
                return parsed
              }),
            { concurrency: "unbounded" }
          )

          const validationResults = yield* validator.runValidations(
            validationRules,
            validationInputs
          )

          yield* db.validationsQueries.clearAllValidationResults({
            participantId: participant.value.id,
          })

          const dbValidationResults = validationResults.map((result: ValidationEngineResult) => ({
            outcome: result.outcome,
            ruleKey: result.ruleKey,
            message: result.message,
            severity: result.severity,
            fileName: result.fileName ?? null,
            overruled: false,
          }))

          yield* db.validationsQueries.createMultipleValidationResults({
            data: dbValidationResults,
            domain: input.domain,
            reference: input.reference,
          })

          return {
            success: true,
            resultsCount: validationResults.length,
          }
        })
      )
    ),
})
