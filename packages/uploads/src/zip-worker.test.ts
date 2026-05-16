import { assert, describe, it } from "@effect/vitest";
import { S3Service } from "@blikka/aws";
import {
  ParticipantsRepository,
  SubmissionsRepository,
  TopicsRepository,
  type Participant,
  type Submission,
  type Topic,
} from "@blikka/db";
import { Effect, Layer, Option, Ref } from "effect";
import JSZip from "jszip";

import { UploadsConfig } from "./config";
import {
  FailedToGenerateZipError,
  ZipWorker,
  ZipWorkerDataNotFoundError,
  ZipWorkerLayerNoDeps,
  type RunZipTaskInput,
} from "./zip-worker";

const input: RunZipTaskInput = {
  domain: "demo",
  reference: "REF123",
};

const firstPhoto = Uint8Array.from([1, 2, 3]);
const secondPhoto = Uint8Array.from([4, 5, 6]);

const submissions = [
  { id: 11, key: "demo/REF123/01/photo.jpg", topicId: 101 },
  { id: 12, key: "demo/REF123/02/photo.png", topicId: 102 },
] as unknown as readonly Submission[];

const topics = [
  { id: 101, orderIndex: 0 },
  { id: 102, orderIndex: 1 },
] as unknown as readonly Topic[];

const participant = {
  id: 123,
  marathonId: 456,
  reference: input.reference,
  submissions,
} as unknown as Participant;

interface TestState {
  readonly participant: Participant | undefined;
  readonly topics: readonly Topic[];
  readonly files: Record<string, Uint8Array | undefined>;
  readonly getFileResult:
    | Effect.Effect<Option.Option<Uint8Array>, unknown>
    | undefined;
  readonly putFileResult: Effect.Effect<S3PutFileOutput, unknown>;
  readonly createZippedSubmissionResult: Effect.Effect<undefined, unknown>;
  readonly participantLookups: ReadonlyArray<{
    domain: string;
    reference: string;
  }>;
  readonly topicLookups: ReadonlyArray<{ id: number }>;
  readonly fileGets: ReadonlyArray<{ bucket: string; key: string }>;
  readonly filePuts: ReadonlyArray<{
    bucket: string;
    key: string;
    file: Buffer;
  }>;
  readonly zippedSubmissionWrites: ReadonlyArray<{
    data: {
      marathonId: number;
      participantId: number;
      key: string;
      exportType: "zip";
      progress: number;
      status: "completed";
      errors: readonly string[];
    };
  }>;
}

type S3PutFileOutput = Effect.Success<
  ReturnType<S3Service["Service"]["putFile"]>
>;

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participant,
  topics,
  files: {
    [submissions[0]!.key]: firstPhoto,
    [submissions[1]!.key]: secondPhoto,
  },
  getFileResult: undefined,
  putFileResult: Effect.succeed({} as S3PutFileOutput),
  createZippedSubmissionResult: Effect.succeed(undefined),
  participantLookups: [],
  topicLookups: [],
  fileGets: [],
  filePuts: [],
  zippedSubmissionWrites: [],
  ...overrides,
});

const updateTestState = (
  stateRef: Ref.Ref<TestState>,
  f: (state: TestState) => TestState,
) => Ref.update(stateRef, f);

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: ({
      domain,
      reference,
    }: {
      domain: string;
      reference: string;
    }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          participantLookups: [
            ...current.participantLookups,
            { domain, reference },
          ],
        }));
        return Option.fromNullishOr(state.participant);
      }),
  } as unknown as ParticipantsRepository["Service"]);

  const topicsRepository = TopicsRepository.of({
    getTopicsByMarathonId: ({ id }: { id: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          topicLookups: [...current.topicLookups, { id }],
        }));
        return [...state.topics];
      }),
  } as unknown as TopicsRepository["Service"]);

  const submissionsRepository = SubmissionsRepository.of({
    createZippedSubmission: (
      dto: TestState["zippedSubmissionWrites"][number],
    ) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          zippedSubmissionWrites: [...current.zippedSubmissionWrites, dto],
        }));
        return yield* state.createZippedSubmissionResult;
      }),
  } as unknown as SubmissionsRepository["Service"]);

  const s3 = S3Service.of({
    getFile: (bucket: string, key: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          fileGets: [...current.fileGets, { bucket, key }],
        }));

        if (state.getFileResult !== undefined) {
          return yield* state.getFileResult;
        }

        return Option.fromNullishOr(state.files[key]);
      }),
    putFile: (bucket: string, key: string, file: Buffer) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          filePuts: [...current.filePuts, { bucket, key, file }],
        }));
        return yield* state.putFileResult;
      }),
  } as unknown as S3Service["Service"]);

  return ZipWorkerLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(S3Service)(s3),
        Layer.succeed(UploadsConfig)(
          UploadsConfig.of({
            submissionsBucketName: "submissions",
            thumbnailsBucketName: "thumbnails",
            contactSheetsBucketName: "contact-sheets",
            zipsBucketName: "zips",
          }),
        ),
      ),
    ),
  );
};

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, ZipWorker>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state);
    const result = yield* effect(stateRef).pipe(
      Effect.provide(makeTestLayer(stateRef)),
    );
    const finalState = yield* Ref.get(stateRef);
    return { result, state: finalState };
  });

describe("ZipWorker", () => {
  it.effect(
    "builds, uploads, and records a zip for participant submissions",
    () =>
      Effect.gen(function* () {
        const { result: zipBuffer, state } = yield* runWithState(
          makeInitialState(),
          () =>
            Effect.gen(function* () {
              const worker = yield* ZipWorker;
              return yield* worker.runZipTask(input);
            }),
        );

        const zip = yield* Effect.promise(() => JSZip.loadAsync(zipBuffer));
        const firstEntry = yield* Effect.promise(
          () =>
            zip.file("REF123_01.jpg")?.async("uint8array") ??
            Promise.reject(new Error("missing")),
        );
        const secondEntry = yield* Effect.promise(
          () =>
            zip.file("REF123_02.png")?.async("uint8array") ??
            Promise.reject(new Error("missing")),
        );

        assert.deepStrictEqual([...firstEntry], [...firstPhoto]);
        assert.deepStrictEqual([...secondEntry], [...secondPhoto]);
        assert.deepStrictEqual(state.participantLookups, [
          { domain: input.domain, reference: input.reference },
        ]);
        assert.deepStrictEqual(state.topicLookups, [
          { id: participant.marathonId },
        ]);
        assert.deepStrictEqual(state.fileGets, [
          { bucket: "submissions", key: submissions[0]!.key },
          { bucket: "submissions", key: submissions[1]!.key },
        ]);
        assert.lengthOf(state.filePuts, 1);
        assert.strictEqual(state.filePuts[0]?.bucket, "zips");
        assert.strictEqual(state.filePuts[0]?.key, "demo/REF123.zip");
        assert.strictEqual(state.filePuts[0]?.file, zipBuffer);
        assert.deepStrictEqual(state.zippedSubmissionWrites, [
          {
            data: {
              marathonId: participant.marathonId,
              participantId: participant.id,
              key: "demo/REF123.zip",
              exportType: "zip",
              progress: 100,
              status: "completed",
              errors: [],
            },
          },
        ]);
      }),
  );

  it.effect("fails when participant is missing", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({ participant: undefined }),
        () =>
          Effect.gen(function* () {
            const worker = yield* ZipWorker;
            return yield* Effect.flip(worker.runZipTask(input));
          }),
      );

      assert.instanceOf(error, ZipWorkerDataNotFoundError);
      assert.strictEqual(error.message, "Participant not found");
      assert.deepStrictEqual(state.topicLookups, []);
      assert.deepStrictEqual(state.fileGets, []);
      assert.deepStrictEqual(state.filePuts, []);
      assert.deepStrictEqual(state.zippedSubmissionWrites, []);
    }),
  );

  it.effect("fails when a submission topic is missing", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({ topics: topics.slice(0, 1) }),
        () =>
          Effect.gen(function* () {
            const worker = yield* ZipWorker;
            return yield* Effect.flip(worker.runZipTask(input));
          }),
      );

      assert.instanceOf(error, ZipWorkerDataNotFoundError);
      assert.strictEqual(error.message, "Topic not found");
      assert.strictEqual(error.key, submissions[1]!.key);
      assert.deepStrictEqual(state.filePuts, []);
      assert.deepStrictEqual(state.zippedSubmissionWrites, []);
    }),
  );

  it.effect("fails when a submission file is missing", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          files: {
            [submissions[0]!.key]: firstPhoto,
            [submissions[1]!.key]: undefined,
          },
        }),
        () =>
          Effect.gen(function* () {
            const worker = yield* ZipWorker;
            return yield* Effect.flip(worker.runZipTask(input));
          }),
      );

      assert.instanceOf(error, ZipWorkerDataNotFoundError);
      assert.strictEqual(error.message, "File not found");
      assert.strictEqual(error.key, submissions[1]!.key);
      assert.deepStrictEqual(state.filePuts, []);
      assert.deepStrictEqual(state.zippedSubmissionWrites, []);
    }),
  );

  it.effect("maps s3 get failures into FailedToGenerateZipError", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          getFileResult: Effect.fail(new Error("s3 unavailable")),
        }),
        () =>
          Effect.gen(function* () {
            const worker = yield* ZipWorker;
            return yield* Effect.flip(worker.runZipTask(input));
          }),
      );

      assert.instanceOf(error, FailedToGenerateZipError);
      assert.strictEqual(error.message, "Failed to get file from s3");
      assert.deepStrictEqual(state.filePuts, []);
      assert.deepStrictEqual(state.zippedSubmissionWrites, []);
    }),
  );

  it.effect(
    "maps zipped submission write failures into FailedToGenerateZipError",
    () =>
      Effect.gen(function* () {
        const { result: error, state } = yield* runWithState(
          makeInitialState({
            createZippedSubmissionResult: Effect.fail(
              new Error("db unavailable"),
            ),
          }),
          () =>
            Effect.gen(function* () {
              const worker = yield* ZipWorker;
              return yield* Effect.flip(worker.runZipTask(input));
            }),
        );

        assert.instanceOf(error, FailedToGenerateZipError);
        assert.strictEqual(
          error.message,
          "Failed to save zipped submission to db",
        );
        assert.lengthOf(state.filePuts, 1);
        assert.lengthOf(state.zippedSubmissionWrites, 1);
      }),
  );
});
