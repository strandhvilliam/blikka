import { Database } from "@blikka/db";
import type { RuleConfig } from "@blikka/db";
import { S3Service } from "@blikka/aws";
import { isCurrentUploadSession, KVStore } from "@blikka/kv-store";
import type { ExifState, SubmissionState } from "@blikka/kv-store";
import {
  RuleKeySchema,
  ValidationEngine,
  ValidationInputSchema,
  ValidationRuleSchema,
} from "@blikka/validation";
import { Config, Effect, Layer, Option, Schema, ServiceMap } from "effect";

export interface ValidationRunnerConfigShape {
  readonly submissionsBucketName: string;
}

export class ValidationRunnerConfig extends ServiceMap.Service<ValidationRunnerConfig>()(
  "@blikka/uploads/ValidationRunnerConfig",
  {
    make: Effect.gen(function* () {
      const submissionsBucketName = yield* Config.string(
        "SUBMISSIONS_BUCKET_NAME",
      );
      return { submissionsBucketName } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

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

export const makeValidationRules = Effect.fn(
  "ValidationRunner.makeValidationRules",
)(
  function* (rules: RuleConfig[]) {
    return yield* Effect.forEach(
      rules,
      (rule) =>
        Effect.gen(function* () {
          const validationRule = yield* Schema.decodeUnknownEffect(
            RuleKeySchema,
          )(rule.ruleKey);
          return yield* Schema.decodeUnknownEffect(
            ValidationRuleSchema(validationRule),
          )({
            ruleKey: validationRule,
            enabled: rule.enabled,
            severity: rule.severity,
            params: { [validationRule]: rule.params },
          });
        }),
      { concurrency: "unbounded" },
    );
  },
  Effect.mapError(
    (error) =>
      new InvalidValidationRuleError({ message: error.message, cause: error }),
  ),
);

export const makeValidationInputs = Effect.fn(
  "ValidationRunner.makeValidationInputs",
)(function* (
  exifStates: { orderIndex: number; exif: ExifState }[],
  submissionStates: readonly SubmissionState[],
) {
  const s3 = yield* S3Service;
  const config = yield* ValidationRunnerConfig;

  return yield* Effect.forEach(
    submissionStates,
    (submissionState) =>
      Effect.gen(function* () {
        const exifState = exifStates.find(
          (e) => e.orderIndex === submissionState.orderIndex,
        );
        const head = yield* s3.getHead(
          config.submissionsBucketName,
          submissionState.key,
        );

        return ValidationInputSchema.makeUnsafe({
          exif: exifState?.exif ?? {},
          fileName: submissionState.key,
          mimeType: head.ContentType ?? "image/jpeg",
          fileSize: head.ContentLength ?? 0,
          orderIndex: submissionState.orderIndex,
        });
      }),
    { concurrency: 5 },
  );
});

export const validateParticipant = Effect.fn(
  "ValidationRunner.validateParticipant",
)(function* (domain: string, reference: string, uploadSessionId: string) {
  const db = yield* Database;
  const kv = yield* KVStore;
  const validator = yield* ValidationEngine;

  return yield* Effect.gen(function* () {
    const participant = yield* db.participantsQueries
      .getParticipantByReference({ domain, reference })
      .pipe(
        Effect.andThen(
          Option.match({
            onSome: (participant) => Effect.succeed(participant),
            onNone: () =>
              Effect.fail(
                new ValidationRunnerInvalidDataError({
                  message: "Participant not found",
                }),
              ),
          }),
        ),
      );

    const participantState = yield* kv.uploadRepository
      .getParticipantState(domain, reference)
      .pipe(
        Effect.andThen(
          Option.match({
            onSome: (participantState) => Effect.succeed(participantState),
            onNone: () =>
              Effect.fail(
                new ValidationRunnerInvalidDataError({
                  message: "Participant state not found",
                }),
              ),
          }),
        ),
      );

    if (!participantState.finalized) {
      yield* Effect.logWarning(
        "Participant state not finalized, skipping validation",
      );
      return;
    }

    const sessionGuard = isCurrentUploadSession({
      eventUploadSessionId: uploadSessionId,
      participantState,
    });
    if (!sessionGuard.matched) {
      yield* Effect.logWarning(
        "Dropping validation event for non-current upload session",
        {
          reason: sessionGuard.reason,
          uploadSessionId,
        },
      );
      return;
    }

    if (participantState.validated) {
      yield* Effect.logWarning("Participant already validated, skipping");
      return;
    }

    const rules = yield* db.rulesQueries.getRulesByDomain({ domain });
    const orderIndexes = [...participantState.orderIndexes];

    const [exifStates, submissionStates] = yield* Effect.all(
      [
        kv.exifRepository.getAllExifStates(domain, reference, orderIndexes),
        kv.uploadRepository.getAllSubmissionStates(
          domain,
          reference,
          orderIndexes,
        ),
      ],
      { concurrency: 2 },
    );

    if (submissionStates.length === 0) {
      return yield* new ValidationRunnerInvalidDataError({
        message: "Submission states not found",
      });
    }

    const exifStatesByOrderIndex = new Set(
      exifStates.map((state) => state.orderIndex),
    );
    const missingExifOrderIndexes = submissionStates
      .filter((state) => !exifStatesByOrderIndex.has(state.orderIndex))
      .map((state) => state.orderIndex);

    if (missingExifOrderIndexes.length > 0) {
      yield* Effect.logWarning(
        "Missing EXIF state during validation; continuing with empty EXIF data",
        { missingExifOrderIndexes },
      );
    }

    const validationInputs = yield* makeValidationInputs(
      exifStates,
      submissionStates,
    );
    const validationRules = yield* makeValidationRules(rules);
    const validationResults = yield* validator.runValidations(
      validationRules,
      validationInputs,
    );

    yield* db.validationsQueries.createMultipleValidationResults({
      data: validationResults,
      domain,
      reference,
    });

    yield* kv.uploadRepository.updateParticipantSession(domain, reference, {
      validated: true,
    });
  }).pipe(Effect.annotateLogs({ domain, reference }));
});

export const ValidationRunnerLive = Layer.mergeAll(
  Database.layer,
  ValidationRunnerConfig.layer,
  S3Service.layer,
  KVStore.layer,
  ValidationEngine.layer,
);
