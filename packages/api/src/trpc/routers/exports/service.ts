import { extname } from "node:path";

import archiver from "archiver";
import { Config, Effect, Layer, Option, Context } from "effect";

import { S3Service } from "@blikka/aws";
import { DbLayer, ExportsRepository, MarathonsRepository } from "@blikka/db";

import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionService,
} from "../../utils/phone-number-encryption";
import { ExportsApiError } from "./schemas";

export class ExportsApiService extends Context.Service<ExportsApiService>()(
  "@blikka/api/ExportsApiService",
  {
    make: Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository;
      const exportsRepository = yield* ExportsRepository;
      const s3 = yield* S3Service;
      const phoneEncryption = yield* PhoneNumberEncryptionService;

      const getActiveByCameraTopic = Effect.fn(
        "ExportsApiService.getActiveByCameraTopic",
      )(function* ({ domain }: { domain: string }) {
        const marathonOption =
          yield* marathonsRepository.getMarathonByDomainWithOptions({
            domain,
          });

        const marathon = yield* Option.match(marathonOption, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              new ExportsApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        });

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new ExportsApiError({
              message: `Marathon '${domain}' is not in by-camera mode`,
            }),
          );
        }

        const activeTopic =
          marathon.topics.find((topic) => topic.visibility === "active") ??
          null;

        if (!activeTopic) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: `No active topic found for marathon '${domain}'`,
            }),
          );
        }

        return activeTopic;
      });

      const buildArchiveBuffer = Effect.fn(
        "ExportsApiService.buildArchiveBuffer",
      )(function* (
        files: ReadonlyArray<{
          data: Buffer;
          name: string;
        }>,
      ) {
        return yield* Effect.tryPromise({
          try: () =>
            new Promise<Buffer>((resolve, reject) => {
              const archive = archiver("zip", {
                zlib: { level: 6 },
              });
              const chunks: Buffer[] = [];

              archive.on("data", (chunk: Buffer) => chunks.push(chunk));
              archive.on("end", () => resolve(Buffer.concat(chunks)));
              archive.on("error", reject);

              for (const file of files) {
                archive.append(file.data, { name: file.name });
              }

              void archive.finalize();
            }),
          catch: (error) =>
            new ExportsApiError({
              message: "Failed to build export archive",
              cause: error,
            }),
        });
      });

      const getSubmissionFileExtension = (
        key: string,
        mimeType: string | null,
      ) => {
        const fileExtension = extname(key);

        if (fileExtension) {
          return fileExtension.toLowerCase();
        }

        switch (mimeType) {
          case "image/png":
            return ".png";
          case "image/webp":
            return ".webp";
          case "image/heic":
            return ".heic";
          case "image/heif":
            return ".heif";
          case "image/tiff":
            return ".tif";
          default:
            return ".jpg";
        }
      };

      const getParticipantsExportData = Effect.fn(
        "ExportsApiService.getParticipantsExportData",
      )(function* ({ domain }: { domain: string }) {
        try {
          return yield* exportsRepository.getParticipantsForExport({ domain });
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch participants export data",
              cause: error,
            }),
          );
        }
      });

      const getParticipantsExportDataByCameraActiveTopic = Effect.fn(
        "ExportsApiService.getParticipantsExportDataByCameraActiveTopic",
      )(function* ({ domain }: { domain: string }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain });

          return yield* exportsRepository.getParticipantsForExportByTopic({
            domain,
            topicId: activeTopic.id,
          });
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch by-camera participants export data",
              cause: error,
            }),
          );
        }
      });

      const getParticipantsExportDataByCameraAllTopics = Effect.fn(
        "ExportsApiService.getParticipantsExportDataByCameraAllTopics",
      )(function* ({ domain }: { domain: string }) {
        try {
          const participants =
            yield* exportsRepository.getParticipantsForExportByCameraAllTopics({
              domain,
            });

          return yield* Effect.forEach(
            participants,
            (participant) =>
              Effect.gen(function* () {
                const phoneNumber = participant.phoneEncrypted
                  ? yield* phoneEncryption
                      .decrypt({
                        encrypted:
                          participant.phoneEncrypted as EncryptedPhoneNumber,
                      })
                      .pipe(Effect.catch(() => Effect.succeed("")))
                  : "";

                const { phoneEncrypted, ...rest } = participant;

                return {
                  ...rest,
                  phoneNumber,
                };
              }),
            { concurrency: 8 },
          );
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message:
                "Failed to fetch by-camera all-topic participants export data",
              cause: error,
            }),
          );
        }
      });

      const getSubmissionsExportData = Effect.fn(
        "ExportsApiService.getSubmissionsExportData",
      )(function* ({ domain }: { domain: string }) {
        try {
          const rows = yield* exportsRepository.getSubmissionsForExport({
            domain,
          });

          return yield* Effect.forEach(
            rows,
            (submission) =>
              Effect.gen(function* () {
                const phoneNumber = submission.phoneEncrypted
                  ? yield* phoneEncryption
                      .decrypt({
                        encrypted:
                          submission.phoneEncrypted as EncryptedPhoneNumber,
                      })
                      .pipe(Effect.catch(() => Effect.succeed("")))
                  : "";

                const { phoneEncrypted, ...rest } = submission;

                return {
                  ...rest,
                  phoneNumber,
                };
              }),
            { concurrency: 8 },
          );
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch submissions export data",
              cause: error,
            }),
          );
        }
      });

      const getSubmissionsExportDataByCameraActiveTopic = Effect.fn(
        "ExportsApiService.getSubmissionsExportDataByCameraActiveTopic",
      )(function* ({ domain }: { domain: string }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain });

          const rows = yield* exportsRepository.getSubmissionsForExportByTopic({
            domain,
            topicId: activeTopic.id,
          });

          return yield* Effect.forEach(
            rows,
            (submission) =>
              Effect.gen(function* () {
                const phoneNumber = submission.phoneEncrypted
                  ? yield* phoneEncryption
                      .decrypt({
                        encrypted:
                          submission.phoneEncrypted as EncryptedPhoneNumber,
                      })
                      .pipe(Effect.catch(() => Effect.succeed("")))
                  : "";

                const { phoneEncrypted, ...rest } = submission;

                return {
                  ...rest,
                  phoneNumber,
                };
              }),
            { concurrency: 8 },
          );
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch by-camera submissions export data",
              cause: error,
            }),
          );
        }
      });

      const getExifExportData = Effect.fn(
        "ExportsApiService.getExifExportData",
      )(function* ({ domain }: { domain: string }) {
        try {
          return yield* exportsRepository.getExifDataForExport({ domain });
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch EXIF export data",
              cause: error,
            }),
          );
        }
      });

      const getValidationResultsExportData = Effect.fn(
        "ExportsApiService.getValidationResultsExportData",
      )(function* ({
        domain,
        onlyFailed,
      }: {
        domain: string;
        onlyFailed?: boolean;
      }) {
        try {
          return yield* exportsRepository.getValidationResultsForExport({
            domain,
            onlyFailed,
          });
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch validation results export data",
              cause: error,
            }),
          );
        }
      });

      const getValidationResultsExportDataByCameraActiveTopic = Effect.fn(
        "ExportsApiService.getValidationResultsExportDataByCameraActiveTopic",
      )(function* ({
        domain,
        onlyFailed,
      }: {
        domain: string;
        onlyFailed?: boolean;
      }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain });

          return yield* exportsRepository.getValidationResultsForExportByTopic({
            domain,
            topicId: activeTopic.id,
            onlyFailed,
          });
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message:
                "Failed to fetch by-camera validation results export data",
              cause: error,
            }),
          );
        }
      });

      const buildByCameraActiveTopicImagesZip = Effect.fn(
        "ExportsApiService.buildByCameraActiveTopicImagesZip",
      )(function* ({ domain }: { domain: string }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain });
          const submissionsBucketName = yield* Config.string(
            "SUBMISSIONS_BUCKET_NAME",
          );
          const submissions =
            yield* exportsRepository.getSubmissionFilesForTopicExport({
              domain,
              topicId: activeTopic.id,
            });

          const files = yield* Effect.forEach(
            submissions,
            (submission) =>
              Effect.gen(function* () {
                const fileOption = yield* s3.getFile(
                  submissionsBucketName,
                  submission.key,
                );

                if (Option.isNone(fileOption)) {
                  return yield* Effect.fail(
                    new ExportsApiError({
                      message: `Submission file not found: ${submission.key}`,
                    }),
                  );
                }

                return {
                  data: Buffer.from(fileOption.value),
                  name: `${submission.participant.reference.padStart(4, "0")}-${submission.id}${getSubmissionFileExtension(
                    submission.key,
                    submission.mimeType,
                  )}`,
                };
              }),
            { concurrency: 5 },
          );

          const zipBuffer = yield* buildArchiveBuffer(files);

          return {
            topicName: activeTopic.name,
            zipBuffer,
          };
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to build by-camera topic image archive",
              cause: error,
            }),
          );
        }
      });

      return {
        getParticipantsExportData,
        getParticipantsExportDataByCameraActiveTopic,
        getParticipantsExportDataByCameraAllTopics,
        getSubmissionsExportData,
        getSubmissionsExportDataByCameraActiveTopic,
        getExifExportData,
        getValidationResultsExportData,
        getValidationResultsExportDataByCameraActiveTopic,
        buildByCameraActiveTopicImagesZip,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        DbLayer,
        S3Service.layer,
        PhoneNumberEncryptionService.layer,
      ),
    ),
  );
}
