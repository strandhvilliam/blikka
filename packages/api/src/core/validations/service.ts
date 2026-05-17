import 'server-only'

import { Config, Effect, Layer, Option, Schema, Context } from 'effect'
import {
  DbLayer,
  ParticipantsRepository,
  MarathonsRepository,
  RulesRepository,
  ValidationsRepository,
  DbError,
  type RuleConfig,
  type Submission,
} from '@blikka/db'
import { S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  RealtimeEventsService,
  RealtimeEventsServiceLayer,
  type RealtimeError,
} from '@blikka/realtime'
import { EmailService, EmailServiceLayer } from '@blikka/email'
import {
  ValidationEngine,
  ValidationRuleSchema,
  RuleKeySchema,
  ValidationEngineLayer,
} from '@blikka/validation'
import type { ValidationEngineError } from '@blikka/validation'
import { NotFoundError, failNotFoundIfNone } from '../errors'
import { getRealtimeChannelEnvironmentFromNodeEnv } from '@blikka/realtime/contract'
import { sendParticipantVerifiedEmail } from '../participants/notifications'
import type {
  CreateParticipantVerificationServiceInput,
  GetParticipantVerificationByReference,
  RunValidations,
  UpdateValidationResult,
} from './contracts'

type ParticipantVerificationByReference = Effect.Success<
  ReturnType<ValidationsRepository['Service']['getParticipantVerificationByReference']>
>

type UpdatedValidationResultRow = Effect.Success<
  ReturnType<ValidationsRepository['Service']['updateValidationResult']>
>

export class ValidationsService extends Context.Service<
  ValidationsService,
  {
    /** Runs rule engine over the participant's submissions and persists validation results for `domain` / `reference`. */
    readonly runValidations: (
      input: RunValidations,
    ) => Effect.Effect<
      { success: boolean; resultsCount: number },
      Schema.SchemaError | DbError | Config.ConfigError | NotFoundError | ValidationEngineError,
      never
    >

    /** Inserts staff verification, marks participant verified, emails + realtime when applicable. */
    readonly createParticipantVerification: (
      input: CreateParticipantVerificationServiceInput,
    ) => Effect.Effect<{ id: number }, DbError | RealtimeError | NotFoundError, EmailService>

    /** Updates overruled flag on a stored validation result row. */
    readonly updateValidationResult: (
      input: UpdateValidationResult,
    ) => Effect.Effect<UpdatedValidationResultRow, DbError, never>

    /** Latest participant verification row with nested participant graph, or null. */
    readonly getParticipantVerificationByReference: (
      input: GetParticipantVerificationByReference,
    ) => Effect.Effect<ParticipantVerificationByReference, DbError, never>
  }
>()('@blikka/api/validations-api-service') {}

const makeValidationsService = Effect.gen(function* () {
  const validationsRepository = yield* ValidationsRepository
  const rulesRepository = yield* RulesRepository
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const s3 = yield* S3Service
  const validator = yield* ValidationEngine
  const realtimeEvents = yield* RealtimeEventsService
  const environment = getRealtimeChannelEnvironmentFromNodeEnv(
    yield* Config.string('NODE_ENV').pipe(Config.withDefault('development')),
  )

  const runValidations: ValidationsService['Service']['runValidations'] = Effect.fn(
    'ValidationsService.runValidations',
  )(function* ({ domain, reference }) {
    const submissionsBucketName = yield* Config.string('NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME')

    const participant = yield* participantsRepository
      .getParticipantByReference({ reference, domain })
      .pipe(failNotFoundIfNone('Participant', { reference, domain }))

    const rules = yield* rulesRepository.getRulesByDomain({
      domain,
    })

    const validationInputs = yield* Effect.forEach(
      participant.submissions,
      (submission) =>
        Effect.gen(function* () {
          let fileSize = submission.size ?? 0
          let mimeType = submission.mimeType ?? 'image/jpeg'

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
      { concurrency: 'unbounded' },
    )

    const validationRules = yield* Effect.forEach(
      rules,
      (rule) =>
        Effect.gen(function* () {
          const validationRuleKey = yield* Schema.decodeUnknownEffect(RuleKeySchema)(rule.ruleKey)
          const ruleKeyStr = validationRuleKey as string
          const parsed = yield* Schema.decodeUnknownEffect(ValidationRuleSchema(validationRuleKey))(
            {
              ruleKey: validationRuleKey,
              enabled: rule.enabled,
              severity: rule.severity,
              params: { [ruleKeyStr]: rule.params },
            },
          )
          return parsed
        }),
      { concurrency: 'unbounded' },
    )

    const validationResults = yield* validator.runValidations(validationRules, validationInputs)

    yield* validationsRepository.clearAllValidationResults({
      participantId: participant.id,
    })

    const dbValidationResults = validationResults.map((result) => ({
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

  const createParticipantVerification: ValidationsService['Service']['createParticipantVerification'] =
    Effect.fn('ValidationsService.createParticipantVerification')(function* ({
      participantId,
      staffId,
      notes,
    }) {
      const participant = yield* participantsRepository
        .getParticipantById({ id: participantId })
        .pipe(failNotFoundIfNone('Participant', { id: participantId }))

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
          status: 'verified',
        },
      })

      const marathon = Option.getOrUndefined(
        yield* marathonsRepository.getMarathonByDomain({
          domain: participant.domain,
        }),
      )

      if (marathon) {
        yield* sendParticipantVerifiedEmail({
          participantEmail: participant.email,
          participantFirstName: participant.firstname,
          participantLastName: participant.lastname,
          participantReference: participant.reference,
          marathonName: marathon.name,
          marathonLogoUrl: marathon.logoUrl,
          marathonMode: marathon.mode,
        })
      }

      yield* realtimeEvents.emitEventResult({
        environment,
        domain: participant.domain,
        reference: participant.reference,
        eventKey: 'participant-verified',
        outcome: 'success',
        timestamp: Date.now(),
        channels: 'participant',
      })

      return { id: verification.id }
    })

  const updateValidationResult: ValidationsService['Service']['updateValidationResult'] = Effect.fn(
    'ValidationsService.updateValidationResult',
  )(function* ({ id, data }) {
    return yield* validationsRepository.updateValidationResult({
      id,
      data,
    })
  })

  const getParticipantVerificationByReference: ValidationsService['Service']['getParticipantVerificationByReference'] =
    Effect.fn('ValidationsService.getParticipantVerificationByReference')(function* ({
      domain,
      reference,
    }) {
      return yield* validationsRepository.getParticipantVerificationByReference({
        domain,
        reference,
      })
    })

  return ValidationsService.of({
    runValidations,
    createParticipantVerification,
    updateValidationResult,
    getParticipantVerificationByReference,
  })
})

export const ValidationsServiceLayerNoDeps = Layer.effect(
  ValidationsService,
  makeValidationsService,
)

export const ValidationsServiceLayer = ValidationsServiceLayerNoDeps.pipe(
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
