import { Config, Effect, Layer, Option, Schema, Context } from "effect"
import {
  DbLayer,
  ParticipantsRepository,
  MarathonsRepository,
  RulesRepository,
  ValidationsRepository,
  type RuleConfig,
  type Submission,
} from "@blikka/db"
import { S3Service, S3ServiceLayer } from "@blikka/aws"
import { RealtimeEventsService, RealtimeEventsServiceLayer } from "@blikka/realtime"
import { EmailService, EmailServiceLayer } from "@blikka/email"
import {
  ValidationEngine,
  ValidationInputSchema,
  ValidationRuleSchema,
  RuleKeySchema,
  type ValidationResult,
  ValidationEngineLayer,
} from "@blikka/validation"
import { ValidationsApiError } from "./errors"
import { getRealtimeChannelEnvironmentFromNodeEnv } from "@blikka/realtime/contract"
import { sendParticipantVerifiedEmail } from "../participants/notifications"

export class ValidationsService extends Context.Service<ValidationsService>()(
  "@blikka/api/validations-api-service",
  {
    make: Effect.gen(function* () {
      const validationsRepository = yield* ValidationsRepository
      const rulesRepository = yield* RulesRepository
      const marathonsRepository = yield* MarathonsRepository
      const participantsRepository = yield* ParticipantsRepository
      const s3 = yield* S3Service
      const validator = yield* ValidationEngine
      const realtimeEvents = yield* RealtimeEventsService
      const environment = getRealtimeChannelEnvironmentFromNodeEnv(
        yield* Config.string("NODE_ENV").pipe(Config.withDefault("development")),
      )

      const runValidations = Effect.fn("ValidationsService.runValidations")(function* ({
        domain,
        reference,
      }: {
        domain: string
        reference: string
      }) {
        const submissionsBucketName = yield* Config.string("NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME")

        const participant = yield* participantsRepository.getParticipantByReference({
          reference,
          domain,
        })

        if (Option.isNone(participant)) {
          return yield* Effect.fail(
            new ValidationsApiError({
              message: "Participant not found",
            }),
          )
        }

        const rules = yield* rulesRepository.getRulesByDomain({
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
                  .pipe(Effect.catch(() => Effect.succeed(null)))
                if (head) {
                  fileSize = head.ContentLength ?? fileSize
                  mimeType = head.ContentType ?? mimeType
                }
              }

              const validationInput = {
                exif: (submission.exif as Record<string, unknown>) ?? {},
                fileName: submission.key,
                fileSize,
                mimeType,
                orderIndex: submission.topic.orderIndex,
              }
              return validationInput
            }),
          { concurrency: "unbounded" },
        )

        const validationRules = yield* Effect.forEach(
          rules,
          (rule: RuleConfig) =>
            Effect.gen(function* () {
              const validationRuleKey = yield* Schema.decodeUnknownEffect(RuleKeySchema)(
                rule.ruleKey,
              )
              const ruleKeyStr = validationRuleKey as string
              const parsed = yield* Schema.decodeUnknownEffect(
                ValidationRuleSchema(validationRuleKey),
              )({
                ruleKey: validationRuleKey,
                enabled: rule.enabled,
                severity: rule.severity,
                params: { [ruleKeyStr]: rule.params },
              })
              return parsed
            }),
          { concurrency: "unbounded" },
        )

        const validationResults = yield* validator.runValidations(validationRules, validationInputs)

        yield* validationsRepository.clearAllValidationResults({
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

        yield* validationsRepository.createMultipleValidationResults({
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
        "ValidationsService.createParticipantVerification",
      )(function* ({
        participantId,
        staffId,
        notes,
      }: {
        participantId: number
        staffId: string
        notes?: string
      }) {
        const participant = yield* participantsRepository.getParticipantById({
          id: participantId,
        })

        if (Option.isNone(participant)) {
          return yield* Effect.fail(
            new ValidationsApiError({
              message: "Participant not found",
            }),
          )
        }

        const verification = yield* validationsRepository.createParticipantVerification({
          data: {
            participantId,
            staffId,
            notes: notes ?? null,
          },
        })

        yield* participantsRepository.updateParticipantById({
          id: participantId,
          data: {
            status: "verified",
          },
        })

        const marathon = Option.getOrUndefined(
          yield* marathonsRepository.getMarathonByDomain({
            domain: participant.value.domain,
          }),
        )

        if (marathon) {
          yield* sendParticipantVerifiedEmail({
            participantEmail: participant.value.email,
            participantFirstName: participant.value.firstname,
            participantLastName: participant.value.lastname,
            participantReference: participant.value.reference,
            marathonName: marathon.name,
            marathonLogoUrl: marathon.logoUrl,
            marathonMode: marathon.mode,
          })
        }

        yield* realtimeEvents.emitEventResult({
          environment,
          domain: participant.value.domain,
          reference: participant.value.reference,
          eventKey: "participant-verified",
          outcome: "success",
          timestamp: Date.now(),
          channels: "participant",
        })

        return { id: verification.id }
      })

      const updateValidationResult = Effect.fn("ValidationsService.updateValidationResult")(
        function* ({
          id,
          data,
        }: {
          id: number
          data: {
            overruled: boolean
          }
        }) {
          return yield* validationsRepository.updateValidationResult({
            id,
            data,
          })
        },
      )

      const getParticipantVerificationByReference = Effect.fn(
        "ValidationsService.getParticipantVerificationByReference",
      )(function* ({ domain, reference }: { domain: string; reference: string }) {
        return yield* validationsRepository.getParticipantVerificationByReference({
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
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        DbLayer,
        RealtimeEventsServiceLayer,
        S3ServiceLayer,
        ValidationEngineLayer,
        EmailServiceLayer,
      ),
    ),
  )
}
