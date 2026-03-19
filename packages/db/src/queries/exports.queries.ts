import { Effect, Layer, ServiceMap } from "effect";

import { and, eq } from "drizzle-orm";

import { DrizzleClient } from "../drizzle-client";

export class ExportsQueries extends ServiceMap.Service<ExportsQueries>()(
  "@blikka/db/exports-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;

      const getMarathonByDomain = Effect.fn(
        "ExportsQueries.getMarathonByDomain",
      )(function* ({ domain }: { domain: string }) {
        return yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
          }),
        );
      });

      const getParticipantValidationCounts = Effect.fn(
        "ExportsQueries.getParticipantValidationCounts",
      )(function* ({ domain }: { domain: string }) {
        const participantsWithValidations = yield* use((db) =>
          db.query.participants.findMany({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              validationResults: true,
            },
          }),
        );

        const validationsByParticipantFile = new Map<
          string,
          {
            passed: number;
            failed: number;
          }
        >();

        for (const participant of participantsWithValidations) {
          for (const validation of participant.validationResults) {
            if (!validation.fileName) {
              continue;
            }

            const key = `${participant.id}-${validation.fileName}`;
            const current = validationsByParticipantFile.get(key) || {
              passed: 0,
              failed: 0,
            };

            if (validation.outcome === "passed") {
              current.passed++;
            } else if (
              validation.outcome === "failed" &&
              !validation.overruled
            ) {
              current.failed++;
            }

            validationsByParticipantFile.set(key, current);
          }
        }

        return validationsByParticipantFile;
      });

      const formatSubmissionForExport = (
        submission: {
          id: number;
          participantId: number;
          key: string;
          thumbnailKey: string | null;
          status: string;
          createdAt: string;
          updatedAt: string | null;
          size: number | null;
          mimeType: string | null;
          exif: Record<string, unknown> | null;
          participant: {
            reference: string;
            firstname: string;
            lastname: string;
            email: string | null;
            competitionClass: { name: string } | null;
            deviceGroup: { name: string } | null;
          };
          topic: {
            name: string;
          };
        },
        validationsByParticipantFile: Map<
          string,
          {
            passed: number;
            failed: number;
          }
        >,
      ) => {
        const validationKey = `${submission.participantId}-${submission.key}`;
        const validations = validationsByParticipantFile.get(validationKey) || {
          passed: 0,
          failed: 0,
        };
        const exifData = submission.exif as Record<string, unknown> | null;
        const cameraModel =
          (exifData?.Model as string | undefined) ||
          (exifData?.CameraModel as string | undefined) ||
          "";
        const imageWidth =
          (exifData?.ImageWidth as number | string | undefined) ||
          (exifData?.ExifImageWidth as number | string | undefined) ||
          "";
        const imageHeight =
          (exifData?.ImageHeight as number | string | undefined) ||
          (exifData?.ExifImageHeight as number | string | undefined) ||
          "";
        const dimensions =
          imageWidth && imageHeight ? `${imageWidth}x${imageHeight}` : "";

        return {
          submissionId: submission.id,
          participantReference: submission.participant.reference,
          participantName: `${submission.participant.firstname} ${submission.participant.lastname}`,
          participantEmail: submission.participant.email || "",
          competitionClassName:
            submission.participant.competitionClass?.name || "",
          deviceGroupName: submission.participant.deviceGroup?.name || "",
          topicName: submission.topic.name,
          submissionStatus: submission.status,
          uploadDate: submission.createdAt,
          lastModified: submission.updatedAt || submission.createdAt,
          fileSize: submission.size || 0,
          mimeType: submission.mimeType || "",
          dimensions,
          cameraModel,
          validationsPassed: validations.passed,
          validationsFailed: validations.failed,
          originalKey: submission.key,
          thumbnailKey: submission.thumbnailKey || "",
        };
      };

      const getParticipantsForExport = Effect.fn(
        "ExportsQueries.getParticipantsForExport",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db.query.participants.findMany({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              competitionClass: true,
              deviceGroup: true,
              submissions: {
                columns: {
                  id: true,
                },
              },
            },
            orderBy: (participants, { asc }) => [asc(participants.reference)],
          }),
        );

        return result.map((participant) => ({
          reference: participant.reference,
          firstname: participant.firstname,
          lastname: participant.lastname,
          email: participant.email || "",
          status: participant.status,
          competitionClassName: participant.competitionClass?.name || "",
          deviceGroupName: participant.deviceGroup?.name || "",
          createdAt: participant.createdAt,
          uploadCount: participant.submissions?.length || 0,
        }));
      });

      const getParticipantsForExportByTopic = Effect.fn(
        "ExportsQueries.getParticipantsForExportByTopic",
      )(function* ({
        domain,
        topicId,
      }: {
        domain: string;
        topicId: number;
      }) {
        const result = yield* use((db) =>
          db.query.participants.findMany({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              competitionClass: true,
              deviceGroup: true,
              submissions: {
                where: (table, operators) => operators.eq(table.topicId, topicId),
                columns: {
                  id: true,
                },
              },
            },
            orderBy: (participants, { asc }) => [asc(participants.reference)],
          }),
        );

        return result
          .filter((participant) => participant.submissions.length > 0)
          .map((participant) => ({
            reference: participant.reference,
            firstname: participant.firstname,
            lastname: participant.lastname,
            email: participant.email || "",
            status: participant.status,
            competitionClassName: participant.competitionClass?.name || "",
            deviceGroupName: participant.deviceGroup?.name || "",
            createdAt: participant.createdAt,
            uploadCount: participant.submissions.length,
          }));
      });

      const getSubmissionsForExport = Effect.fn(
        "ExportsQueries.getSubmissionsForExport",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* getMarathonByDomain({ domain });

        if (!marathon) {
          return [];
        }

        const validationsByParticipantFile = yield* getParticipantValidationCounts({
          domain,
        });

        const result = yield* use((db) =>
          db.query.submissions.findMany({
            where: (table, operators) =>
              operators.eq(table.marathonId, marathon.id),
            with: {
              participant: {
                with: {
                  competitionClass: true,
                  deviceGroup: true,
                },
              },
              topic: true,
            },
            orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
          }),
        );

        return result.map((submission) =>
          formatSubmissionForExport(submission, validationsByParticipantFile),
        );
      });

      const getSubmissionsForExportByTopic = Effect.fn(
        "ExportsQueries.getSubmissionsForExportByTopic",
      )(function* ({
        domain,
        topicId,
      }: {
        domain: string;
        topicId: number;
      }) {
        const marathon = yield* getMarathonByDomain({ domain });

        if (!marathon) {
          return [];
        }

        const validationsByParticipantFile = yield* getParticipantValidationCounts({
          domain,
        });

        const result = yield* use((db) =>
          db.query.submissions.findMany({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, marathon.id),
                operators.eq(table.topicId, topicId),
              ),
            with: {
              participant: {
                with: {
                  competitionClass: true,
                  deviceGroup: true,
                },
              },
              topic: true,
            },
            orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
          }),
        );

        return result.map((submission) =>
          formatSubmissionForExport(submission, validationsByParticipantFile),
        );
      });

      const getExifDataForExport = Effect.fn(
        "ExportsQueries.getExifDataForExport",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* getMarathonByDomain({ domain });

        if (!marathon) {
          return [];
        }

        const result = yield* use((db) =>
          db.query.submissions.findMany({
            where: (table, operators) =>
              operators.eq(table.marathonId, marathon.id),
            with: {
              participant: true,
              topic: true,
            },
            orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
          }),
        );

        return result
          .filter((submission) => submission.exif && submission.key)
          .map((submission) => ({
            submissionId: submission.id,
            participantReference: submission.participant.reference,
            topicName: submission.topic.name,
            originalKey: submission.key,
            exifData: submission.exif as Record<string, unknown>,
            uploadDate: submission.createdAt,
          }));
      });

      const getValidationResultsForExport = Effect.fn(
        "ExportsQueries.getValidationResultsForExport",
      )(function* ({
        domain,
        onlyFailed,
      }: {
        domain: string;
        onlyFailed?: boolean;
      }) {
        const marathon = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              participants: {
                with: {
                  validationResults: true,
                  submissions: {
                    columns: {
                      key: true,
                    },
                  },
                },
              },
            },
          }),
        );

        if (!marathon) {
          return [];
        }

        const allResults: Array<{
          participantId: number;
          participantReference: string;
          participantName: string;
          ruleKey: string;
          severity: string;
          outcome: string;
          message: string;
          fileName: string | null;
          createdAt: string;
          overruled: boolean;
        }> = [];

        for (const participant of marathon.participants) {
          for (const validationResult of participant.validationResults) {
            if (onlyFailed && validationResult.outcome !== "failed") {
              continue;
            }

            allResults.push({
              participantId: participant.id,
              participantReference: participant.reference,
              participantName: `${participant.firstname} ${participant.lastname}`,
              ruleKey: validationResult.ruleKey,
              severity: validationResult.severity,
              outcome: validationResult.outcome,
              message: validationResult.message,
              fileName: validationResult.fileName,
              createdAt: validationResult.createdAt,
              overruled: validationResult.overruled,
            });
          }
        }

        return allResults.filter((result, index, array) => {
          const key = `${result.participantId}-${result.ruleKey}-${result.fileName || "global"}`;

          return (
            array.findIndex((candidate) => {
              const candidateKey = `${candidate.participantId}-${candidate.ruleKey}-${candidate.fileName || "global"}`;
              return candidateKey === key;
            }) === index
          );
        });
      });

      const getValidationResultsForExportByTopic = Effect.fn(
        "ExportsQueries.getValidationResultsForExportByTopic",
      )(function* ({
        domain,
        topicId,
        onlyFailed,
      }: {
        domain: string;
        topicId: number;
        onlyFailed?: boolean;
      }) {
        const marathon = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              participants: {
                with: {
                  validationResults: true,
                  submissions: {
                    columns: {
                      key: true,
                      topicId: true,
                    },
                  },
                },
              },
            },
          }),
        );

        if (!marathon) {
          return [];
        }

        const allResults: Array<{
          participantId: number;
          participantReference: string;
          participantName: string;
          ruleKey: string;
          severity: string;
          outcome: string;
          message: string;
          fileName: string | null;
          createdAt: string;
          overruled: boolean;
        }> = [];

        for (const participant of marathon.participants) {
          const topicSubmissionKeys = new Set(
            participant.submissions
              .filter((submission) => submission.topicId === topicId)
              .map((submission) => submission.key),
          );

          if (topicSubmissionKeys.size === 0) {
            continue;
          }

          for (const validationResult of participant.validationResults) {
            if (onlyFailed && validationResult.outcome !== "failed") {
              continue;
            }

            if (!validationResult.fileName) {
              continue;
            }

            if (!topicSubmissionKeys.has(validationResult.fileName)) {
              continue;
            }

            allResults.push({
              participantId: participant.id,
              participantReference: participant.reference,
              participantName: `${participant.firstname} ${participant.lastname}`,
              ruleKey: validationResult.ruleKey,
              severity: validationResult.severity,
              outcome: validationResult.outcome,
              message: validationResult.message,
              fileName: validationResult.fileName,
              createdAt: validationResult.createdAt,
              overruled: validationResult.overruled,
            });
          }
        }

        return allResults.filter((result, index, array) => {
          const key = `${result.participantId}-${result.ruleKey}-${result.fileName}`;

          return (
            array.findIndex((candidate) => {
              const candidateKey = `${candidate.participantId}-${candidate.ruleKey}-${candidate.fileName}`;
              return candidateKey === key;
            }) === index
          );
        });
      });

      const getSubmissionFilesForTopicExport = Effect.fn(
        "ExportsQueries.getSubmissionFilesForTopicExport",
      )(function* ({
        domain,
        topicId,
      }: {
        domain: string;
        topicId: number;
      }) {
        const marathon = yield* getMarathonByDomain({ domain });

        if (!marathon) {
          return [];
        }

        return yield* use((db) =>
          db.query.submissions.findMany({
            where: (table) =>
              and(eq(table.marathonId, marathon.id), eq(table.topicId, topicId)),
            columns: {
              id: true,
              key: true,
              mimeType: true,
            },
            with: {
              participant: {
                columns: {
                  reference: true,
                },
              },
            },
            orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
          }),
        );
      });

      return {
        getParticipantsForExport,
        getParticipantsForExportByTopic,
        getSubmissionsForExport,
        getSubmissionsForExportByTopic,
        getExifDataForExport,
        getValidationResultsForExport,
        getValidationResultsForExportByTopic,
        getSubmissionFilesForTopicExport,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
