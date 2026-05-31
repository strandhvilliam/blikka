
import { resolveSubmissionContentType, S3Service, S3ServiceLayer, S3ClientError } from '@blikka/aws'
import {
  DbLayer,
  ParticipantsRepository,
  TopicsRepository,
  SubmissionsRepository,
  DbError,
} from '@blikka/db'
import {
  ExifParser,
  ExifParserLayer,
  SharpImageService,
  SharpImageServiceLayer,
} from '@blikka/image-manipulation'
import type { ValidationEngineError } from '@blikka/validation'
import { Config, Effect, Layer, Option, Context, Schema } from 'effect'

import { ValidationsService, ValidationsServiceLayer } from '../validations/service'
import { NotFoundError } from '../errors'
import {
  type BeginAdminReplaceUploadServiceInput,
  type CompleteAdminReplaceUploadServiceInput,
  type RegenerateSubmissionAssetsServiceInput,
} from './contracts'
import {
  AdminReplaceSubmissionError,
  assertReplaceTargetMatchesSubmission,
  makeThumbnailKey,
  parseSubmissionStorageKey,
} from './replace-submission'

const THUMBNAIL_WIDTH = 512

export class SubmissionsService extends Context.Service<
  SubmissionsService,
  {
    /**
     * Starts an admin replacement upload: validates domain admin, returns a presigned PUT URL and
     * staging `key` for the replacement object.
     */
    readonly beginAdminReplaceUpload: (input: BeginAdminReplaceUploadServiceInput) => Effect.Effect<
      {
        key: string
        presignedPutUrl: string
        contentType:
          | 'image/jpeg'
          | 'image/gif'
          | 'image/heic'
          | 'image/heif'
          | 'image/png'
          | 'image/webp'
        previousKey: string
      },
      DbError | S3ClientError | Config.ConfigError | AdminReplaceSubmissionError,
      never
    >

    /**
     * Finalizes replacement after upload: re-keys submission, regenerates thumbnail/EXIF, best-effort
     * deletes old assets, and reruns validations for the participant.
     */
    readonly completeAdminReplaceUpload: (
      input: CompleteAdminReplaceUploadServiceInput,
    ) => Effect.Effect<
      {
        success: boolean
        key: string
        thumbnailKey: string | null
        validationResultsCount: number
      },
      | Schema.SchemaError
      | DbError
      | Config.ConfigError
      | AdminReplaceSubmissionError
      | NotFoundError
      | ValidationEngineError,
      ValidationsService
    >

    /**
     * Regenerates stored EXIF and/or thumbnail from the current original in S3, optionally reruns
     * validations; requires admin for the marathon `domain`.
     */
    readonly regenerateSubmissionAssets: (
      input: RegenerateSubmissionAssetsServiceInput,
    ) => Effect.Effect<
      {
        success: boolean
        exifFieldCount: number
        thumbnailKey: string | null
        validationResultsCount: number
        regeneratedExif: boolean
        regeneratedThumbnail: boolean
        reranValidations: boolean
        participantReference: string
        topicOrderIndex: number
      },
      | Schema.SchemaError
      | DbError
      | Config.ConfigError
      | AdminReplaceSubmissionError
      | NotFoundError
      | ValidationEngineError,
      ValidationsService
    >
  }
>()('@blikka/api/SubmissionsService') {}

const makeSubmissionsService = Effect.gen(function* () {
  const submissionsRepository = yield* SubmissionsRepository
  const topicsRepository = yield* TopicsRepository
  const participantsRepository = yield* ParticipantsRepository
  const s3 = yield* S3Service
  const exifParser = yield* ExifParser
  const sharp = yield* SharpImageService

  const requireAdminForDomain = Effect.fn('SubmissionsService.requireAdminForDomain')(function* ({
    domain,
    isAdminForDomain,
  }) {
    if (!isAdminForDomain) {
      return yield* Effect.fail(
        new AdminReplaceSubmissionError({
          message: `Admin access is required for domain: ${domain}`,
        }),
      )
    }
  })

  const getSubmissionContext = Effect.fn('SubmissionsService.getSubmissionContext')(function* ({
    domain,
    submissionId,
  }) {
    const submissionOption = yield* submissionsRepository.getSubmissionById({
      id: submissionId,
    })

    if (Option.isNone(submissionOption)) {
      return yield* Effect.fail(
        new AdminReplaceSubmissionError({
          message: 'Submission not found',
        }),
      )
    }

    const submission = submissionOption.value
    const participantOption = yield* participantsRepository.getParticipantById({
      id: submission.participantId,
    })

    if (Option.isNone(participantOption)) {
      return yield* Effect.fail(
        new AdminReplaceSubmissionError({
          message: 'Submission participant not found',
        }),
      )
    }

    const participant = participantOption.value

    if (participant.domain !== domain) {
      return yield* Effect.fail(
        new AdminReplaceSubmissionError({
          message: 'Submission does not belong to this domain',
        }),
      )
    }

    const topic = yield* topicsRepository.getTopicById({
      id: submission.topicId,
    })

    if (!topic) {
      return yield* Effect.fail(
        new AdminReplaceSubmissionError({
          message: 'Submission topic not found',
        }),
      )
    }

    return {
      submission,
      participant,
      topic,
    }
  })

  const getReplacementHead = Effect.fn('SubmissionsService.getReplacementHead')(function* ({
    bucketName,
    key,
  }) {
    return yield* s3.getHead(bucketName, key).pipe(
      Effect.mapError(
        (error) =>
          new AdminReplaceSubmissionError({
            message: `Replacement upload not found: ${key}`,
            cause: error,
          }),
      ),
    )
  })

  const getReplacementBytes = Effect.fn('SubmissionsService.getReplacementBytes')(function* ({
    bucketName,
    key,
  }) {
    const fileOption = yield* s3.getFile(bucketName, key).pipe(
      Effect.mapError(
        (error) =>
          new AdminReplaceSubmissionError({
            message: `Failed to read replacement upload: ${key}`,
            cause: error,
          }),
      ),
    )

    if (Option.isNone(fileOption)) {
      return yield* Effect.fail(
        new AdminReplaceSubmissionError({
          message: `Replacement upload is empty: ${key}`,
        }),
      )
    }

    return fileOption.value
  })

  const processReplacementImage = Effect.fn('SubmissionsService.processReplacementImage')(
    function* ({
      bytes,
      parsedKey,
      thumbnailsBucketName,
    }: {
      bytes: Uint8Array<ArrayBufferLike>
      parsedKey: ReturnType<typeof parseSubmissionStorageKey>
      thumbnailsBucketName: string
    }) {
      const nextThumbnailKey = makeThumbnailKey(parsedKey)

      const [exif, thumbnailKey] = yield* Effect.all(
        [
          exifParser
            .parse(bytes)
            .pipe(
              Effect.catch(() =>
                Effect.logWarning(
                  `Failed to parse EXIF for replacement: ${parsedKey.fileName}`,
                ).pipe(Effect.andThen(Effect.succeed<Record<string, unknown>>({}))),
              ),
            ),
          sharp.resize(bytes, { width: THUMBNAIL_WIDTH }).pipe(
            Effect.andThen((thumbnailBuffer) =>
              s3
                .putFile(thumbnailsBucketName, nextThumbnailKey, thumbnailBuffer)
                .pipe(Effect.as<string | null>(nextThumbnailKey)),
            ),
            Effect.catch(() =>
              Effect.logWarning(
                `Failed to generate thumbnail for replacement: ${parsedKey.fileName}`,
              ).pipe(Effect.andThen(Effect.succeed<string | null>(null))),
            ),
          ),
        ],
        { concurrency: 2 },
      )

      return {
        exif,
        thumbnailKey,
      }
    },
  )

  const regenerateSubmissionAssets: SubmissionsService['Service']['regenerateSubmissionAssets'] =
    Effect.fn('SubmissionsService.regenerateSubmissionAssets')(function* ({
      domain,
      submissionId,
      regenerateExif,
      regenerateThumbnail,
      rerunValidations,
      isAdminForDomain,
    }) {
      yield* requireAdminForDomain({ domain, isAdminForDomain })

      const shouldProcessAssets = regenerateExif || regenerateThumbnail
      const { submission, participant, topic } = yield* getSubmissionContext({
        domain,
        submissionId,
      })

      let nextExif = (submission.exif as Record<string, unknown> | null) ?? {}
      let nextThumbnailKey = submission.thumbnailKey

      if (shouldProcessAssets) {
        const submissionsBucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
        const thumbnailsBucketName = yield* Config.string('THUMBNAILS_BUCKET_NAME')
        const bytes = yield* getReplacementBytes({
          bucketName: submissionsBucketName,
          key: submission.key,
        })
        const parsedKey = parseSubmissionStorageKey(submission.key)
        const generatedThumbnailKey = makeThumbnailKey(parsedKey)

        if (parsedKey.domain !== domain) {
          return yield* Effect.fail(
            new AdminReplaceSubmissionError({
              message: 'Submission does not belong to this domain',
            }),
          )
        }

        const [regeneratedExif, regeneratedThumbnailKey] = yield* Effect.all(
          [
            regenerateExif
              ? exifParser
                  .parse(bytes)
                  .pipe(
                    Effect.catch(() =>
                      Effect.logWarning(
                        `Failed to regenerate EXIF for submission: ${submission.key}`,
                      ).pipe(Effect.andThen(Effect.succeed<Record<string, unknown>>({}))),
                    ),
                  )
              : Effect.succeed(nextExif),
            regenerateThumbnail
              ? sharp.resize(bytes, { width: THUMBNAIL_WIDTH }).pipe(
                  Effect.andThen((thumbnailBuffer) =>
                    s3
                      .putFile(thumbnailsBucketName, generatedThumbnailKey, thumbnailBuffer)
                      .pipe(Effect.as<string | null>(generatedThumbnailKey)),
                  ),
                  Effect.catch(() =>
                    Effect.logWarning(
                      `Failed to regenerate thumbnail for submission: ${submission.key}`,
                    ).pipe(Effect.andThen(Effect.succeed<string | null>(nextThumbnailKey))),
                  ),
                )
              : Effect.succeed(nextThumbnailKey),
          ],
          { concurrency: 2 },
        )

        nextExif = regeneratedExif
        nextThumbnailKey = regeneratedThumbnailKey

        yield* submissionsRepository.updateSubmissionById({
          id: submission.id,
          data: {
            exif: nextExif,
            thumbnailKey: nextThumbnailKey,
            updatedAt: new Date().toISOString(),
          },
        })
      }

      const validationResult = rerunValidations
        ? yield* ValidationsService.use((service) =>
            service.runValidations({
              domain,
              reference: participant.reference,
            }),
          )
        : null

      return {
        success: true,
        exifFieldCount: Object.keys(nextExif).length,
        thumbnailKey: nextThumbnailKey,
        validationResultsCount: validationResult?.resultsCount ?? 0,
        regeneratedExif: regenerateExif,
        regeneratedThumbnail: regenerateThumbnail,
        reranValidations: rerunValidations,
        participantReference: participant.reference,
        topicOrderIndex: topic.orderIndex,
      }
    })

  const deleteFileBestEffort = Effect.fn('SubmissionsService.deleteFileBestEffort')(function* ({
    bucketName,
    key,
  }: {
    bucketName: string
    key: string | null | undefined
  }) {
    if (!key) {
      return
    }

    yield* s3
      .deleteFile(bucketName, key)
      .pipe(Effect.catch(() => Effect.logWarning(`Failed to delete replaced asset: ${key}`)))
  })

  const beginAdminReplaceUpload: SubmissionsService['Service']['beginAdminReplaceUpload'] =
    Effect.fn('SubmissionsService.beginAdminReplaceUpload')(function* ({
      domain,
      submissionId,
      contentType,
      isAdminForDomain,
    }) {
      yield* requireAdminForDomain({ domain, isAdminForDomain })

      const { participant, topic, submission } = yield* getSubmissionContext({
        domain,
        submissionId,
      })
      const submissionsBucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
      const normalizedContentType = resolveSubmissionContentType(contentType)
      const key = yield* s3.generateSubmissionKey(domain, participant.reference, topic.orderIndex, {
        filenamePrefix: 'replace',
        contentType: normalizedContentType,
      })
      const presignedPutUrl = yield* s3.getPresignedUrl(submissionsBucketName, key, 'PUT', {
        contentType: normalizedContentType,
      })

      return {
        key,
        presignedPutUrl,
        contentType: normalizedContentType,
        previousKey: submission.key,
      }
    })

  const completeAdminReplaceUpload: SubmissionsService['Service']['completeAdminReplaceUpload'] =
    Effect.fn('SubmissionsService.completeAdminReplaceUpload')(function* ({
      domain,
      submissionId,
      newKey,
      previousKey,
      isAdminForDomain,
    }) {
      yield* requireAdminForDomain({ domain, isAdminForDomain })

      const { submission, participant, topic } = yield* getSubmissionContext({
        domain,
        submissionId,
      })

      if (submission.key !== previousKey) {
        return yield* Effect.fail(
          new AdminReplaceSubmissionError({
            message: 'Submission changed before the replacement completed',
          }),
        )
      }

      const parsedKey = parseSubmissionStorageKey(newKey)

      assertReplaceTargetMatchesSubmission({
        parsedKey,
        expectedDomain: domain,
        expectedReference: participant.reference,
        expectedOrderIndex: topic.orderIndex,
      })

      const submissionsBucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
      const thumbnailsBucketName = yield* Config.string('THUMBNAILS_BUCKET_NAME')

      const previousThumbnailKey = submission.thumbnailKey
      const previousPreviewKey = submission.previewKey

      const head = yield* getReplacementHead({
        bucketName: submissionsBucketName,
        key: newKey,
      })
      const bytes = yield* getReplacementBytes({
        bucketName: submissionsBucketName,
        key: newKey,
      })
      const { exif, thumbnailKey } = yield* processReplacementImage({
        bytes,
        parsedKey,
        thumbnailsBucketName,
      })

      yield* submissionsRepository.updateSubmissionById({
        id: submission.id,
        data: {
          key: newKey,
          thumbnailKey,
          previewKey: null,
          exif,
          size: head.ContentLength ?? null,
          mimeType: resolveSubmissionContentType(head.ContentType),
          status: 'uploaded',
          updatedAt: new Date().toISOString(),
        },
      })

      yield* Effect.all(
        [
          deleteFileBestEffort({
            bucketName: submissionsBucketName,
            key: submission.key === newKey ? null : submission.key,
          }),
          deleteFileBestEffort({
            bucketName: thumbnailsBucketName,
            key: previousThumbnailKey,
          }),
          deleteFileBestEffort({
            bucketName: submissionsBucketName,
            key: previousPreviewKey,
          }),
        ],
        { concurrency: 3 },
      )

      const validationResult = yield* ValidationsService.use((service) =>
        service.runValidations({
          domain,
          reference: participant.reference,
        }),
      )

      return {
        success: true,
        key: newKey,
        thumbnailKey,
        validationResultsCount: validationResult.resultsCount,
      }
    })

  return SubmissionsService.of({
    beginAdminReplaceUpload,
    completeAdminReplaceUpload,
    regenerateSubmissionAssets,
  })
})

export const SubmissionsServiceLayerNoDeps = Layer.effect(
  SubmissionsService,
  makeSubmissionsService,
)

export const SubmissionsServiceLayer = SubmissionsServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DbLayer,
      S3ServiceLayer,
      ExifParserLayer,
      SharpImageServiceLayer,
      ValidationsServiceLayer,
    ),
  ),
)
