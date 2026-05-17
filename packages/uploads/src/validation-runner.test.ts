import { assert, describe, it } from "@effect/vitest";
import { S3Service } from "@blikka/aws";
import {
  ParticipantsRepository,
  RulesRepository,
  ValidationsRepository,
} from "@blikka/db";
import type { RuleConfig } from "@blikka/db";
import {
  ExifKVRepository,
  type ExifState,
  type ParticipantState,
  type SubmissionState,
  UploadSessionRepository,
} from "@blikka/kv-store";
import {
  RULE_KEYS,
  VALIDATION_OUTCOME,
  ValidationEngine,
  type ValidationInput,
  type ValidationResult,
  type ValidationRule,
} from "@blikka/validation";
import { Effect, Layer, Option, Ref } from "effect";

import { UploadsConfig } from "./config";
import {
  InvalidValidationRuleError,
  ValidationRunnerInvalidDataError,
  ValidationRunner,
  ValidationRunnerLayerNoDeps,
  type ValidateParticipantInput,
} from "./validation-runner";

const uploadSessionId = "upload-session-1";
const input: ValidateParticipantInput = {
  domain: "demo",
  reference: "REF123",
  uploadSessionId,
};

const submissionState: SubmissionState = {
  uploadSessionId,
  key: "demo/REF123/01/photo.jpg",
  orderIndex: 0,
  uploaded: true,
  thumbnailKey: null,
  exifProcessed: true,
};

const makeParticipantState = (
  overrides: Partial<ParticipantState> = {},
): ParticipantState => ({
  uploadSessionId,
  expectedCount: 1,
  orderIndexes: [0],
  processedIndexes: [1],
  validated: false,
  zipKey: "",
  contactSheetKey: "",
  errors: [],
  finalized: true,
  checkedAt: null,
  ...overrides,
});

const maxFileSizeRule = {
  id: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
  marathonId: 1,
  ruleKey: RULE_KEYS.MAX_FILE_SIZE,
  enabled: true,
  severity: "error",
  params: { maxBytes: 10_000 },
} satisfies RuleConfig;

const validationResult: ValidationResult = {
  outcome: VALIDATION_OUTCOME.PASSED,
  ruleKey: RULE_KEYS.MAX_FILE_SIZE,
  message: "passed",
  severity: "error",
  fileName: submissionState.key,
  orderIndex: submissionState.orderIndex,
  isGeneral: false,
};

interface TestState {
  readonly participantExists: boolean;
  readonly participantState: ParticipantState | undefined;
  readonly exifStates: ReadonlyArray<{ orderIndex: number; exif: ExifState }>;
  readonly submissionStates: readonly SubmissionState[];
  readonly rules: readonly RuleConfig[];
  readonly validationInputs: readonly ValidationInput[];
  readonly validationRules: readonly ValidationRule[];
  readonly validationWrites: ReadonlyArray<{
    domain: string;
    reference: string;
    data: readonly ValidationResult[];
  }>;
  readonly participantUpdates: ReadonlyArray<Partial<ParticipantState>>;
  readonly headRequests: ReadonlyArray<{ bucket: string; key: string }>;
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participantExists: true,
  participantState: makeParticipantState(),
  exifStates: [{ orderIndex: 0, exif: { Make: "Nikon" } }],
  submissionStates: [submissionState],
  rules: [maxFileSizeRule],
  validationInputs: [],
  validationRules: [],
  validationWrites: [],
  participantUpdates: [],
  headRequests: [],
  ...overrides,
});

const updateTestState = (
  stateRef: Ref.Ref<TestState>,
  f: (state: TestState) => TestState,
) => Ref.update(stateRef, f);

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return state.participantExists ? Option.some({}) : Option.none();
      }),
  } as unknown as ParticipantsRepository["Service"]);

  const rulesRepository = RulesRepository.of({
    getRulesByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return [...state.rules];
      }),
  } as unknown as RulesRepository["Service"]);

  const validationsRepository = ValidationsRepository.of({
    createMultipleValidationResults: ({
      data,
      domain,
      reference,
    }: {
      data: readonly ValidationResult[];
      domain: string;
      reference: string;
    }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        validationWrites: [
          ...state.validationWrites,
          { data, domain, reference },
        ],
      })).pipe(Effect.as(undefined)),
  } as unknown as ValidationsRepository["Service"]);

  const uploadKv = UploadSessionRepository.of({
    getParticipantState: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return Option.fromNullishOr(state.participantState);
      }),
    getAllSubmissionStates: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return [...state.submissionStates];
      }),
    updateParticipantSession: (
      _domain: string,
      _reference: string,
      participantState: Partial<ParticipantState>,
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        participantUpdates: [...state.participantUpdates, participantState],
      })).pipe(Effect.as(1)),
  } as unknown as UploadSessionRepository["Service"]);

  const exifKv = ExifKVRepository.of({
    getAllExifStates: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return [...state.exifStates];
      }),
  } as unknown as ExifKVRepository["Service"]);

  const s3 = S3Service.of({
    getHead: (bucket: string, key: string) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        headRequests: [...state.headRequests, { bucket, key }],
      })).pipe(
        Effect.as({
          ContentType: "image/jpeg",
          ContentLength: 123,
        } as Effect.Success<ReturnType<S3Service["Service"]["getHead"]>>),
      ),
  } as unknown as S3Service["Service"]);

  const validationEngine = ValidationEngine.of({
    runValidations: (
      rules: ValidationRule[],
      validationInputs: ValidationInput[],
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        validationRules: rules,
        validationInputs,
      })).pipe(Effect.as([validationResult])),
  });

  return ValidationRunnerLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(RulesRepository)(rulesRepository),
        Layer.succeed(ValidationsRepository)(validationsRepository),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        Layer.succeed(ExifKVRepository)(exifKv),
        Layer.succeed(S3Service)(s3),
        Layer.succeed(UploadsConfig)(
          UploadsConfig.of({
            submissionsBucketName: "submissions",
            sponsorsBucketName: "sponsors",
            thumbnailsBucketName: "thumbnails",
            contactSheetsBucketName: "contact-sheets",
            zipsBucketName: "zips",
          }),
        ),
        Layer.succeed(ValidationEngine)(validationEngine),
      ),
    ),
  );
};

const runWithState = <A, E>(
  state: TestState,
  effect: (
    stateRef: Ref.Ref<TestState>,
  ) => Effect.Effect<A, E, ValidationRunner>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state);
    const result = yield* effect(stateRef).pipe(
      Effect.provide(makeTestLayer(stateRef)),
    );
    const finalState = yield* Ref.get(stateRef);
    return { result, state: finalState };
  });

describe("ValidationRunner", () => {
  it.effect(
    "validates finalized current-session submissions and marks participant validated",
    () =>
      Effect.gen(function* () {
        const { state } = yield* runWithState(makeInitialState(), () =>
          Effect.gen(function* () {
            const runner = yield* ValidationRunner;
            yield* runner.execute(input);
          }),
        );

        assert.deepStrictEqual(state.headRequests, [
          { bucket: "submissions", key: submissionState.key },
        ]);
        assert.deepStrictEqual(state.validationInputs, [
          {
            exif: { Make: "Nikon" },
            fileName: submissionState.key,
            mimeType: "image/jpeg",
            fileSize: 123,
            orderIndex: submissionState.orderIndex,
          },
        ]);
        assert.deepStrictEqual(state.validationWrites, [
          {
            domain: input.domain,
            reference: input.reference,
            data: [validationResult],
          },
        ]);
        assert.deepStrictEqual(state.participantUpdates, [{ validated: true }]);
      }),
  );

  it.effect("skips validation when participant state is not finalized", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({ finalized: false }),
        }),
        () =>
          Effect.gen(function* () {
            const runner = yield* ValidationRunner;
            yield* runner.execute(input);
          }),
      );

      assert.deepStrictEqual(state.headRequests, []);
      assert.deepStrictEqual(state.validationWrites, []);
      assert.deepStrictEqual(state.participantUpdates, []);
    }),
  );

  it.effect("skips stale upload-session validation events", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({
            uploadSessionId: "new-upload-session",
          }),
        }),
        () =>
          Effect.gen(function* () {
            const runner = yield* ValidationRunner;
            yield* runner.execute(input);
          }),
      );

      assert.deepStrictEqual(state.headRequests, []);
      assert.deepStrictEqual(state.validationWrites, []);
      assert.deepStrictEqual(state.participantUpdates, []);
    }),
  );

  it.effect("fails when submission states are missing", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          submissionStates: [],
        }),
        () =>
          Effect.gen(function* () {
            const runner = yield* ValidationRunner;
            return yield* Effect.flip(runner.execute(input));
          }),
      );

      assert.isTrue(error instanceof ValidationRunnerInvalidDataError);
      assert.strictEqual(error.message, "No submission states found");
      assert.deepStrictEqual(state.validationWrites, []);
      assert.deepStrictEqual(state.participantUpdates, []);
    }),
  );

  it.effect("maps invalid rule data into InvalidValidationRuleError", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          rules: [
            {
              ...maxFileSizeRule,
              params: { maxBytes: -1 },
            } as RuleConfig,
          ],
        }),
        () =>
          Effect.gen(function* () {
            const runner = yield* ValidationRunner;
            return yield* Effect.flip(runner.execute(input));
          }),
      );

      assert.isTrue(error instanceof InvalidValidationRuleError);
      assert.deepStrictEqual(state.validationWrites, []);
      assert.deepStrictEqual(state.participantUpdates, []);
    }),
  );
});
