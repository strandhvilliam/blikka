import {
  DbLayer,
  MarathonsRepository,
  ParticipantsRepository,
  RulesRepository,
  ValidationsRepository,
} from '@blikka/db'
import type { DbError, ParticipantStatusTransitionResult, RuleConfig } from '@blikka/db'
import { S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  ExifKVRepository,
  ExifKVRepositoryLayer,
  ExifKVRepositoryError,
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'
import { type ExifState, type SubmissionState } from '@blikka/kv-store'
import {
  RuleKeySchema,
  ValidationEngine,
  ValidationEngineLayer,
  ValidationInputSchema,
  ValidationRuleSchema,
  type ValidationEngineError,
} from '@blikka/validation'
import { Context, Effect, Layer, Option, Schema } from 'effect'
import { UploadsConfig, UploadsConfigLayer } from './config'
import { resolveMarathonVerificationMode } from './flagged-verification-flow'
import { getValidationDecision } from './validation-decision'

export class ValidationRunnerInvalidDataError extends Schema.TaggedErrorClass<ValidationRunnerInvalidDataError>()(
  'ValidationRunnerInvalidDataError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class InvalidValidationRuleError extends Schema.TaggedErrorClass<InvalidValidationRuleError>()(
  'InvalidValidationRuleError',
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

export class ValidationRunner extends Context.Service<
  ValidationRunner,
  {
    /**
     * Runs upload validation rules, writes the KV decision atomically, and settles DB status
     * (auto-`verified` when flagged mode + `passed` and participant is already `completed`).
     * See `flagged-verification-flow` for the full pipeline.
     */
    readonly execute: (
      input: ValidateParticipantInput,
    ) => Effect.Effect<ParticipantStatusTransitionResult, ValidationRunnerError>
  }
>()('@blikka/uploads/ValidationRunner') {}

const unchangedStatusTransition: ParticipantStatusTransitionResult = {
  changed: false,
  changedToVerified: false,
  status: null,
}

const makeValidationRunner = Effect.gen(function* () {
  const validationsRepository = yield* ValidationsRepository
  const participantsRepository = yield* ParticipantsRepository
  const marathonsRepository = yield* MarathonsRepository
  const rulesRepository = yield* RulesRepository
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
        { concurrency: 'unbounded' },
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
              mimeType: head.ContentType ?? 'image/jpeg',
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

  const hasExifFields = (exif: ExifState | null | undefined) =>
    exif !== null && exif !== undefined && Object.keys(exif).length > 0

  const getVerificationMode = Effect.fnUntraced(function* (domain: string) {
    const marathon = yield* marathonsRepository.getMarathonByDomain({ domain })
    return Option.match(marathon, {
      onNone: () => resolveMarathonVerificationMode(undefined),
      onSome: (value) => resolveMarathonVerificationMode(value),
    })
  })

  /** DB-only settlement after KV decision is written; never marks `completed` (`canMarkCompleted: false`). */
  const settleStatus = Effect.fnUntraced(function* ({
    domain,
    reference,
    validationDecision,
  }: {
    domain: string
    reference: string
    validationDecision: 'passed' | 'flagged'
  }) {
    const verificationMode = yield* getVerificationMode(domain)

    return yield* participantsRepository.settleFinalizedParticipantStatus({
      reference,
      domain,
      canMarkCompleted: false,
      verificationMode,
      validationDecision,
    })
  })

  /**
   * Lua-guarded KV write, then DB settlement. `ALREADY_VALIDATED` replays settlement for repair
   * when validation succeeded earlier but auto-verify did not run.
   */
  const writeValidationDecisionForCurrentSession = Effect.fnUntraced(function* ({
    domain,
    reference,
    uploadSessionId,
    validationDecision,
  }: {
    domain: string
    reference: string
    uploadSessionId: string
    validationDecision: 'passed' | 'flagged'
  }) {
    const result = yield* uploadKv.updateValidationDecisionForSession(
      domain,
      reference,
      uploadSessionId,
      validationDecision,
      new Date().toISOString(),
    )

    switch (result.status) {
      case 'UPDATED':
        return yield* settleStatus({ domain, reference, validationDecision })
      case 'ALREADY_VALIDATED': {
        const currentState = yield* uploadKv.getParticipantState(domain, reference)
        const currentDecision = Option.match(currentState, {
          onNone: () => null,
          onSome: (state) =>
            state.uploadSessionId === uploadSessionId ? (state.validationDecision ?? null) : null,
        })

        if (currentDecision === 'passed' || currentDecision === 'flagged') {
          return yield* settleStatus({
            domain,
            reference,
            validationDecision: currentDecision,
          })
        }

        return unchangedStatusTransition
      }
      case 'STALE_SESSION':
      case 'NOT_FINALIZED':
      case 'MISSING_DATA':
        yield* Effect.logWarning('Skipping validation decision write for non-current session', {
          status: result.status,
        })
        return unchangedStatusTransition
    }
  })

  const execute = Effect.fn('ValidationRunner.execute')(
    function* ({ domain, reference, uploadSessionId }: ValidateParticipantInput) {
      const participantState = yield* uploadKv.getParticipantState(domain, reference)

      if (Option.isNone(participantState)) {
        return yield* new ValidationRunnerInvalidDataError({
          message: 'Participant state not found',
        })
      }

      if (!participantState.value.finalized) {
        yield* Effect.logWarning('Participant state not finalized, skipping validation')
        return unchangedStatusTransition
      }

      if (participantState.value.uploadSessionId !== uploadSessionId) {
        yield* Effect.logWarning('Dropping validation event for non-current upload session', {
          uploadSessionId,
        })
        return unchangedStatusTransition
      }

      if (participantState.value.validated) {
        yield* Effect.logWarning('Participant already validated, skipping')
        const validationDecision = participantState.value.validationDecision
        if (validationDecision === 'passed' || validationDecision === 'flagged') {
          return yield* settleStatus({ domain, reference, validationDecision })
        }
        return unchangedStatusTransition
      }

      const markFlagged = Effect.gen(function* () {
        yield* writeValidationDecisionForCurrentSession({
          domain,
          reference,
          uploadSessionId,
          validationDecision: 'flagged',
        })
      })

      return yield* Effect.gen(function* () {
        const rules = yield* rulesRepository.getRulesByDomain({ domain })
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
            message: 'No submission states found',
          })
        }

        if (submissionStates.length !== orderIndexes.length) {
          return yield* new ValidationRunnerInvalidDataError({
            message: `Submission states length mismatch: expected ${orderIndexes.length} but got ${submissionStates.length}`,
          })
        }

        const exifStatesWithFieldsByOrderIndex = new Set(
          exifStates.filter((state) => hasExifFields(state.exif)).map((state) => state.orderIndex),
        )
        const missingExifOrderIndexes = submissionStates
          .filter((state) => !exifStatesWithFieldsByOrderIndex.has(state.orderIndex))
          .map((state) => state.orderIndex)

        if (missingExifOrderIndexes.length > 0) {
          yield* Effect.logWarning(
            'Missing EXIF state during validation; continuing with empty EXIF data',
            { missingExifOrderIndexes },
          )
        }

        const validationInputs = yield* createValidationInputs(exifStates, submissionStates)
        const validationRules = yield* createValidationRules(rules)
        const validationResults = yield* engine.runValidations(validationRules, validationInputs)

        yield* validationsRepository.createMultipleValidationResults({
          data: validationResults,
          domain,
          reference,
        })

        const validationDecision = getValidationDecision({
          results: validationResults,
          missingExifOrderIndexes,
        })

        return yield* writeValidationDecisionForCurrentSession({
          domain,
          reference,
          uploadSessionId,
          validationDecision,
        })
      }).pipe(Effect.catch((error) => markFlagged.pipe(Effect.andThen(Effect.fail(error)))))
    },
    (effect, input) => Effect.annotateLogs(effect, { ...input }),
  )

  return ValidationRunner.of({ execute })
})

export const ValidationRunnerLayerNoDeps = Layer.effect(ValidationRunner, makeValidationRunner)

export const ValidationRunnerLayer = ValidationRunnerLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DbLayer,
      S3ServiceLayer,
      UploadSessionRepositoryLayer,
      ExifKVRepositoryLayer,
      ValidationEngineLayer,
      UploadsConfigLayer,
    ),
  ),
)
