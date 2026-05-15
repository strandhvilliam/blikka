import { Config, Effect, Layer, Option, Schema, Context } from "effect"
import { Database, RuleConfig } from "@blikka/db"
import {
  SubmissionState,
  ExifState,
  isCurrentUploadSession,
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  ExifKVRepository,
} from "@blikka/kv-store"
import { InvalidDataFoundError, InvalidValidationRuleError } from "./utils"
import { S3Service, S3ServiceLayer } from "@blikka/aws"
import {
  RuleKeySchema,
  ValidationEngine,
  ValidationInputSchema,
  ValidationRuleSchema,
} from "@blikka/validation"

export class ValidationRunner extends Context.Service<ValidationRunner>()(
  "@blikka/ValidationRunner",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service
      const uploadRepository = yield* UploadSessionRepository
      const exifRepository = yield* ExifKVRepository
      const validator = yield* ValidationEngine

      const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")

      const makeValidationRules = Effect.fn("ValidationRunner.makeValidationRules")(
        function* (rules: RuleConfig[]) {
          const validationRules = yield* Effect.forEach(
            rules,
            (rule) =>
              Effect.gen(function* () {
                const validationRule = yield* Schema.decodeUnknownEffect(RuleKeySchema)(
                  rule.ruleKey,
                )
                const parsed = yield* Schema.decodeUnknownEffect(
                  ValidationRuleSchema(validationRule),
                )({
                  ruleKey: validationRule,
                  enabled: rule.enabled,
                  severity: rule.severity,
                  params: { [validationRule]: rule.params },
                })
                return parsed
              }),
            { concurrency: "unbounded" },
          )
          return validationRules
        },
        Effect.mapError(
          (error) => new InvalidValidationRuleError({ message: error.message, cause: error }),
        ),
      )

      const makeValidationInputs = Effect.fn("ValidationRunner.makeValidationInputs")(function* (
        exifStates: { orderIndex: number; exif: ExifState }[],
        submissionStates: readonly SubmissionState[],
      ) {
        const validationInputs = yield* Effect.forEach(
          submissionStates,
          (submissionState) =>
            Effect.gen(function* () {
              const exifState = exifStates.find((e) => e.orderIndex === submissionState.orderIndex)

              const head = yield* s3.getHead(submissionsBucketName, submissionState.key)

              const mimeType = head.ContentType
              const fileSize = head.ContentLength
              const fileName = submissionState.key

              const validationInput = ValidationInputSchema.make({
                exif: exifState?.exif ?? {},
                fileName,
                mimeType: mimeType ?? "image/jpeg",
                fileSize: fileSize ?? 0,
                orderIndex: submissionState.orderIndex,
              })
              return validationInput
            }),
          { concurrency: 5 },
        )
        return validationInputs
      })

      const execute = Effect.fn("ValidationRunner.execute")(function* (
        domain: string,
        reference: string,
        uploadSessionId: string,
      ) {
        return yield* Effect.gen(function* () {
          const participant = yield* db.participantsQueries
            .getParticipantByReference({ domain, reference })
            .pipe(
              Effect.andThen(
                Option.match({
                  onSome: (participant) => Effect.succeed(participant),
                  onNone: () =>
                    Effect.fail(
                      new InvalidDataFoundError({
                        message: "Participant not found",
                      }),
                    ),
                }),
              ),
            )

          const participantState = yield* uploadRepository
            .getParticipantState(domain, reference)
            .pipe(
              Effect.andThen(
                Option.match({
                  onSome: (participantState) => Effect.succeed(participantState),
                  onNone: () =>
                    Effect.fail(
                      new InvalidDataFoundError({
                        message: "Participant state not found",
                      }),
                    ),
                }),
              ),
            )

          if (!participantState.finalized) {
            yield* Effect.logWarning("Participant state not finalized, skipping validation")
            return
          }

          const sessionGuard = isCurrentUploadSession({
            eventUploadSessionId: uploadSessionId,
            participantState,
          })
          if (!sessionGuard.matched) {
            yield* Effect.logWarning("Dropping validation event for non-current upload session", {
              reason: sessionGuard.reason,
              uploadSessionId,
            })
            return
          }

          if (participantState.validated) {
            yield* Effect.logWarning("Participant already validated, skipping")
            return
          }

          const rules = yield* db.rulesQueries.getRulesByDomain({
            domain,
          })

          const orderIndexes = [...participantState.orderIndexes]

          const [exifStates, submissionStates] = yield* Effect.all(
            [
              exifRepository.getAllExifStates(domain, reference, orderIndexes),
              uploadRepository.getAllSubmissionStates(domain, reference, orderIndexes),
            ],
            { concurrency: 2 },
          )

          if (submissionStates.length === 0) {
            return yield* new InvalidDataFoundError({
              message: "Submission states not found",
            })
          }

          const exifStatesByOrderIndex = new Set(exifStates.map((state) => state.orderIndex))
          const missingExifOrderIndexes = submissionStates
            .filter((state) => !exifStatesByOrderIndex.has(state.orderIndex))
            .map((state) => state.orderIndex)

          if (missingExifOrderIndexes.length > 0) {
            yield* Effect.logWarning(
              "Missing EXIF state during validation; continuing with empty EXIF data",
              {
                missingExifOrderIndexes,
              },
            )
          }

          const validationInputs = yield* makeValidationInputs(exifStates, submissionStates)
          const validationRules = yield* makeValidationRules(rules)
          const validationResults = yield* validator.runValidations(
            validationRules,
            validationInputs,
          )

          yield* db.validationsQueries.createMultipleValidationResults({
            data: validationResults,
            domain,
            reference,
          })

          yield* uploadRepository.updateParticipantSession(domain, reference, {
            validated: true,
          })
        }).pipe(Effect.annotateLogs({ domain, reference }))
      })
      return {
        execute,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        Database.layer,
        S3ServiceLayer,
        UploadSessionRepositoryLayer,
        ExifKVRepository.layer,
        ValidationEngine.layer,
      ),
    ),
  )
}
