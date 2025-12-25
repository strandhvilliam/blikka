import { Effect, Option, Schema } from "effect"
import { Database, RuleConfig } from "@blikka/db"
import { SubmissionState, ExifState } from "@blikka/kv-store"
import { InvalidDataFoundError, InvalidValidationRuleError } from "./utils"
import { S3Service } from "@blikka/s3"
import { Resource as SSTResource } from "sst"
import {
  RuleKeySchema,
  ValidationEngine,
  ValidationInput,
  ValidationInputSchema,
  ValidationRule,
  ValidationRuleSchema,
} from "@vimmer/validation"
import { KVStore } from "@blikka/kv-store"

export class ValidationRunner extends Effect.Service<ValidationRunner>()(
  "@vimmer/validation-runner",
  {
    dependencies: [Database.Default, S3Service.Default, KVStore.Default, ValidationEngine.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service
      const kv = yield* KVStore
      const validator = yield* ValidationEngine

      const makeValidationRules = Effect.fn("ValidationRunner.makeValidationRules")(
        function* (rules: RuleConfig[]) {
          const validationRules = yield* Effect.forEach(
            rules,
            (rule) =>
              Effect.gen(function* () {
                const validationRule = yield* Schema.decodeUnknown(RuleKeySchema)(rule.ruleKey)
                const parsed = yield* Schema.decodeUnknown(ValidationRuleSchema(validationRule))({
                  ruleKey: validationRule,
                  enabled: rule.enabled,
                  severity: rule.severity,
                  params: { [validationRule]: rule.params },
                })
                return parsed
              }),
            { concurrency: "unbounded" }
          )
          return validationRules
        },
        Effect.mapError(
          (error) => new InvalidValidationRuleError({ message: error.message, cause: error })
        )
      )

      const makeValidationInputs = Effect.fn("ValidationRunner.makeValidationInputs")(function* (
        exifStates: { orderIndex: number; exif: ExifState }[],
        submissionStates: readonly SubmissionState[]
      ) {
        const validationInputs = yield* Effect.forEach(
          submissionStates,
          (submissionState) =>
            Effect.gen(function* () {
              const exifState = exifStates.find((e) => e.orderIndex === submissionState.orderIndex)

              const head = yield* s3.getHead(
                SSTResource.V2SubmissionsBucket.name,
                submissionState.key
              )

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
          { concurrency: 12 }
        )
        return validationInputs
      })

      const execute = Effect.fn("ValidationRunner.execute")(function* (
        domain: string,
        reference: string
      ) {
        const participantState = yield* kv.uploadRepository
          .getParticipantState(domain, reference)
          .pipe(
            Effect.andThen(
              Option.match({
                onSome: (participantState) => Effect.succeed(participantState),
                onNone: () =>
                  Effect.fail(
                    new InvalidDataFoundError({
                      message: "Participant state not found",
                    })
                  ),
              })
            )
          )

        if (participantState.validated) {
          yield* Effect.logWarning(
            `[${reference}|${domain}] Participant already validated, skipping`
          )
          return
        }

        const rules = yield* db.rulesQueries.getRulesByDomain({
          domain,
        })

        const orderIndexes = participantState.processedIndexes.map((_, i) => i)
        const [exifStates, submissionStates] = yield* Effect.all(
          [
            kv.exifRepository.getAllExifStates(domain, reference, orderIndexes),
            kv.uploadRepository.getAllSubmissionStates(domain, reference, orderIndexes),
          ],
          { concurrency: 2 }
        )

        if (exifStates.length === 0 || submissionStates.length === 0) {
          return yield* new InvalidDataFoundError({
            message: `Exif states or submission states not found for reference ${reference} and domain ${domain}`,
          })
        }

        const validationInputs = yield* makeValidationInputs(exifStates, submissionStates)
        const validationRules = yield* makeValidationRules(rules)
        const validationResults = yield* validator.runValidations(validationRules, validationInputs)

        yield* db.validationsQueries.createMultipleValidationResults({
          data: validationResults,
          domain,
          reference,
        })
      })
      return {
        execute,
      } as const
    }),
  }
) {}
