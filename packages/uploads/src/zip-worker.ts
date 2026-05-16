import { S3Service, S3ServiceLayer, type S3ClientError } from "@blikka/aws";
import {
  DbLayer,
  ParticipantsRepository,
  TopicsRepository,
  SubmissionsRepository,
  type DbError,
  type Participant,
  type Submission,
  type Topic,
} from "@blikka/db";
import { Context, Effect, Layer, Option, Schema } from "effect";
import JSZip from "jszip";
import path from "path";
import { UploadsConfig, UploadsConfigLayer } from "./config";

export class ZipWorkerDataNotFoundError extends Schema.TaggedErrorClass<ZipWorkerDataNotFoundError>()(
  "ZipWorkerDataNotFoundError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    key: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class FailedToGenerateZipError extends Schema.TaggedErrorClass<FailedToGenerateZipError>()(
  "FailedToGenerateZipError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type ZipWorkerError =
  | ZipWorkerDataNotFoundError
  | FailedToGenerateZipError
  | S3ClientError
  | DbError;

export interface RunZipTaskInput {
  readonly domain: string;
  readonly reference: string;
}

interface ZipEntry {
  readonly path: string;
  readonly data: Uint8Array<ArrayBufferLike>;
}

export class ZipWorker extends Context.Service<
  ZipWorker,
  {
    /**
     * Runs the zip worker for a participant.
     * Will zip the participant's submissions and save the zip to S3.
     */
    readonly runZipTask: (
      input: RunZipTaskInput,
    ) => Effect.Effect<Buffer, ZipWorkerError>;
  }
>()("@blikka/uploads/ZipWorker") {}

function createZipKey(domain: string, reference: string) {
  return `${domain}/${reference}.zip`;
}

function createZippedSubmissionDto(domain: string, participant: Participant) {
  return {
    data: {
      marathonId: participant.marathonId,
      participantId: participant.id,
      key: createZipKey(domain, participant.reference),
      exportType: "zip" as const,
      progress: 100,
      status: "completed" as const,
      errors: [],
    },
  };
}

function createZipEntryPath(
  reference: string,
  submission: Submission,
  topics: readonly Topic[],
) {
  const orderIndex = Option.fromNullishOr(
    topics.find((topic) => topic.id === submission.topicId)?.orderIndex,
  );

  if (Option.isNone(orderIndex)) {
    return Option.none<string>();
  }

  const paddedOrderIndex = String(orderIndex.value + 1).padStart(2, "0");
  const extension = path.extname(submission.key).slice(1) || "jpg";
  return Option.some(`${reference}_${paddedOrderIndex}.${extension}`);
}

const makeZipWorker = Effect.gen(function* () {
  const submissionsRepository = yield* SubmissionsRepository;
  const topicsRepository = yield* TopicsRepository;
  const participantsRepository = yield* ParticipantsRepository;
  const s3 = yield* S3Service;
  const config = yield* UploadsConfig;

  const buildZipBuffer = Effect.fn("ZipWorker.buildZipBuffer")(function* (
    domain: string,
    reference: string,
    entries: readonly ZipEntry[],
  ) {
    return yield* Effect.tryPromise({
      try: async () => {
        const zip = new JSZip();
        for (const entry of entries) {
          zip.file(entry.path, entry.data, {
            binary: true,
            compression: "DEFLATE",
          });
        }
        return zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
        });
      },
      catch: (cause) =>
        new FailedToGenerateZipError({
          message: "Failed to build zip buffer",
          cause,
          domain,
          reference,
        }),
    });
  });

  const processSubmission = Effect.fn("ZipWorker.processSubmission")(function* (
    domain: string,
    reference: string,
    submission: Submission,
    topics: readonly Topic[],
  ) {
    const zipPath = createZipEntryPath(reference, submission, topics);

    if (Option.isNone(zipPath)) {
      return yield* new ZipWorkerDataNotFoundError({
        message: "Topic not found",
        domain,
        reference,
        key: submission.key,
      });
    }

    const file = yield* s3
      .getFile(config.submissionsBucketName, submission.key)
      .pipe(
        Effect.mapError(
          (cause) =>
            new FailedToGenerateZipError({
              message: "Failed to get file from s3",
              cause,
              domain,
              reference,
            }),
        ),
      );

    if (Option.isNone(file)) {
      return yield* new ZipWorkerDataNotFoundError({
        message: "File not found",
        domain,
        reference,
        key: submission.key,
      });
    }

    return {
      path: zipPath.value,
      data: file.value,
    } satisfies ZipEntry;
  });

  const runZipTask = Effect.fn("ZipWorker.runZipTask")(
    function* ({ domain, reference }: RunZipTaskInput) {
      const zipKey = createZipKey(domain, reference);

      const participantOpt =
        yield* participantsRepository.getParticipantByReference({
          reference,
          domain,
        });

      if (Option.isNone(participantOpt)) {
        return yield* new ZipWorkerDataNotFoundError({
          message: "Participant not found",
          domain,
          reference,
        });
      }
      const participant = participantOpt.value;

      const topics = yield* topicsRepository.getTopicsByMarathonId({
        id: participant.marathonId,
      });

      const entries = yield* Effect.forEach(
        participant.submissions,
        (submission) =>
          processSubmission(domain, reference, submission, topics),
        { concurrency: 5 },
      );

      const zipBuffer = yield* buildZipBuffer(domain, reference, entries);
      yield* s3.putFile(config.zipsBucketName, zipKey, zipBuffer);

      const zipDto = createZippedSubmissionDto(domain, participant);
      yield* submissionsRepository.createZippedSubmission(zipDto).pipe(
        Effect.mapError(
          (cause) =>
            new FailedToGenerateZipError({
              domain,
              reference,
              message: "Failed to save zipped submission to db",
              cause,
            }),
        ),
      );

      return zipBuffer;
    },
    (effect, input) => Effect.annotateLogs(effect, { ...input }),
  );

  return ZipWorker.of({ runZipTask });
});

export const ZipWorkerLayerNoDeps = Layer.effect(ZipWorker, makeZipWorker);

export const ZipWorkerLayer = ZipWorkerLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, S3ServiceLayer, UploadsConfigLayer)),
);
