import { Config, Effect, Layer, Option, Context } from "effect";
import { ZipKVRepository } from "@blikka/kv-store";
import { Database } from "@blikka/db";
import type { Submission, Topic } from "@blikka/db";
import { S3Service } from "@blikka/aws";
import path from "path";
import JSZip from "jszip";
import { ExportDataNotFoundError, FailedToGenerateZipError } from "./errors";
import { makeZipKey, makeZippedSubmissionDto } from "./zip-utils";

export class ZipWorker extends Context.Service<ZipWorker>()(
  "@blikka/exports/ZipWorker",
  {
    make: Effect.gen(function* () {
      const kvStore = yield* ZipKVRepository;
      const db = yield* Database;
      const s3 = yield* S3Service;
      const submissionsBucketName = yield* Config.string(
        "SUBMISSIONS_BUCKET_NAME",
      );
      const zipsBucketName = yield* Config.string("ZIPS_BUCKET_NAME");

      const buildZipBuffer = Effect.fn("ZipWorker.buildZipBuffer")(function* (
        domain: string,
        reference: string,
        entries: { path: string; data: Uint8Array<ArrayBufferLike> }[],
      ) {
        return yield* Effect.tryPromise({
          try: async () => {
            const zip = new JSZip();
            for (const { path, data } of entries) {
              zip.file(path, data, { binary: true, compression: "DEFLATE" });
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

      const processSubmission = Effect.fn("ZipWorker.processSubmission")(
        function* (
          domain: string,
          reference: string,
          submission: Submission,
          topics: Topic[],
        ) {
          const orderIndex = Option.fromNullishOr(
            topics.find((topic) => topic.id === submission.topicId)?.orderIndex,
          );

          if (Option.isNone(orderIndex)) {
            return yield* new ExportDataNotFoundError({
              message: "Topic not found",
              domain,
              reference,
              key: submission.key,
            });
          }

          const paddedOrderIndex = String(orderIndex.value + 1).padStart(
            2,
            "0",
          );
          const extension = path.extname(submission.key).slice(1) || "jpg";
          const zipPath = `${reference}_${paddedOrderIndex}.${extension}`;

          const buffer = yield* s3
            .getFile(submissionsBucketName, submission.key)
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
              Effect.andThen(
                Option.match({
                  onSome: (file) => Effect.succeed(file),
                  onNone: () =>
                    Effect.fail(
                      new ExportDataNotFoundError({
                        message: "File not found",
                        domain,
                        reference,
                        key: submission.key,
                      }),
                    ),
                }),
              ),
            );

          return { path: zipPath, data: buffer };
        },
      );

      const fetchRequiredData = Effect.fn("ZipWorker.fetchRequiredData")(
        function* (domain: string, reference: string) {
          const participantOpt =
            yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            });
          if (Option.isNone(participantOpt)) {
            return yield* new ExportDataNotFoundError({
              message: "Participant not found",
              domain,
              reference,
            });
          }
          const topics = yield* db.topicsQueries.getTopicsByMarathonId({
            id: participantOpt.value.marathonId,
          });

          return { participant: participantOpt.value, topics };
        },
      );

      const runZipTask = Effect.fn("ZipWorker.runZipTask")(function* (
        domain: string,
        reference: string,
      ) {
        return yield* Effect.gen(function* () {
          const zipKey = makeZipKey(domain, reference);
          yield* kvStore.initializeZipProgress(domain, reference, zipKey);

          const { participant, topics } = yield* fetchRequiredData(
            domain,
            reference,
          );

          const entries = yield* Effect.forEach(
            participant.submissions,
            (submission) =>
              processSubmission(domain, reference, submission, topics).pipe(
                Effect.tap(() =>
                  kvStore.incrementZipProgress(domain, reference),
                ),
              ),
            { concurrency: 5 },
          );

          const zipBuffer = yield* buildZipBuffer(domain, reference, entries);
          yield* s3.putFile(zipsBucketName, zipKey, zipBuffer);

          const zipDto = makeZippedSubmissionDto(domain, participant);
          yield* Effect.all(
            [
              kvStore.completeZipProgress(domain, reference).pipe(
                Effect.mapError(
                  (cause) =>
                    new FailedToGenerateZipError({
                      message: "Failed to save zip progress",
                      cause,
                      domain,
                      reference,
                    }),
                ),
              ),
              db.submissionsQueries.createZippedSubmission(zipDto).pipe(
                Effect.mapError(
                  (cause) =>
                    new FailedToGenerateZipError({
                      domain,
                      reference,
                      message: "Failed to save zipped submission to db",
                      cause,
                    }),
                ),
              ),
            ],
            { concurrency: 2 },
          );

          return zipBuffer;
        }).pipe(Effect.annotateLogs({ domain, reference }));
      });

      return { runZipTask } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(ZipKVRepository.layer, Database.layer, S3Service.layer),
    ),
  );
}
