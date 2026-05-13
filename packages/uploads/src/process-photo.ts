import { Cause, Config, Effect, Layer, Option, Schema, ServiceMap } from "effect"
import { BusService, S3Service } from "@blikka/aws"
import { ExifKVRepository, getUploadSessionId, UploadSessionRepository } from "@blikka/kv-store"
import type { ExifState } from "@blikka/kv-store"
import { ExifParser, SharpImageService } from "@blikka/image-manipulation"
import { hasExifFields, mergeExifStates } from "./exif"
import { makeThumbnailKey } from "./upload-keys"

const THUMBNAIL_WIDTH = 400

export interface UploadProcessorConfigShape {
  readonly submissionsBucketName: string
  readonly thumbnailsBucketName: string
}

export class UploadProcessorConfig extends ServiceMap.Service<
  UploadProcessorConfig,
  UploadProcessorConfigShape
>()("@blikka/uploads/UploadProcessorConfig", {
  make: Effect.gen(function* () {
    const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
    const thumbnailsBucketName = yield* Config.string("THUMBNAILS_BUCKET_NAME")
    return { submissionsBucketName, thumbnailsBucketName } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}

export class UploadProcessorError extends Schema.TaggedErrorClass<UploadProcessorError>()(
  "UploadProcessorPhotoNotFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    details: Schema.optional(Schema.String),
  },
) {}

const generateThumbnail = Effect.fnUntraced(
  function* (
    photo: Uint8Array<ArrayBufferLike>,
    domain: string,
    reference: string,
    orderIndex: number,
    fileName: string,
  ) {
    const s3 = yield* S3Service
    const sharp = yield* SharpImageService
    const config = yield* UploadProcessorConfig

    const thumbnailKey = makeThumbnailKey({
      domain,
      reference,
      orderIndex,
      fileName,
    })
    const resized = yield* sharp.resize(photo, { width: THUMBNAIL_WIDTH })
    yield* s3.putFile(config.thumbnailsBucketName, thumbnailKey, resized)
    return Option.some(thumbnailKey)
  },
  Effect.catchCause((cause) =>
    Effect.logWarning(
      "Thumbnail generation or upload failed; continuing without thumbnail (can retry later)",
      {
        cause: Cause.pretty(cause),
      },
    ).pipe(Effect.as(Option.none<string>())),
  ),
)

const processExif = Effect.fnUntraced(function* (
  photo: Uint8Array<ArrayBufferLike>,
  domain: string,
  reference: string,
  orderIndex: number,
  seededExif: Option.Option<ExifState>,
) {
  const exifParser = yield* ExifParser
  const exifKv = yield* ExifKVRepository

  return yield* exifParser.parse(photo).pipe(
    Effect.map((parsedExif) =>
      Option.match(seededExif, {
        onSome: (seededExifState) => mergeExifStates(seededExifState, parsedExif),
        onNone: () => parsedExif,
      }),
    ),
    Effect.tap((exif) => exifKv.setExifState(domain, reference, orderIndex, exif)),
    Effect.map(Option.some),
    Effect.catchCause((cause) =>
      Option.match(seededExif, {
        onSome: (seededExifState) =>
          Effect.logWarning("EXIF parse or merge persist failed; keeping seeded EXIF", {
            cause: Cause.pretty(cause),
          }).pipe(Effect.as(Option.some(seededExifState))),
        onNone: () =>
          Effect.logWarning(
            "EXIF parse or persist failed; continuing without EXIF (can retry later)",
            { cause: Cause.pretty(cause) },
          ).pipe(Effect.as(Option.none<ExifState>())),
      }),
    ),
  )
})

export interface ProcessPhotoParams {
  key: string
  domain: string
  reference: string
  orderIndex: number
  fileName: string
}

export const processPhoto = Effect.fn("UploadProcessor.processPhoto")(
  function* (params: ProcessPhotoParams) {
    const s3 = yield* S3Service
    const uploadKv = yield* UploadSessionRepository
    const exifKv = yield* ExifKVRepository
    const bus = yield* BusService
    const config = yield* UploadProcessorConfig

    const { key, domain, reference, orderIndex, fileName } = params

    const submissionStateOpt = yield* uploadKv.getSubmissionState(domain, reference, orderIndex)
    if (Option.isNone(submissionStateOpt)) {
      yield* Effect.logWarning("Missing initialized submission state", {
        key,
      })
      return
    }

    if (submissionStateOpt.value.key !== key) {
      yield* Effect.logWarning("Uploaded key does not match initialized submission key", { key })
      return
    }

    const uploadSessionId = submissionStateOpt.value.uploadSessionId ?? ""

    const participantStateOpt = yield* uploadKv.getParticipantState(domain, reference)
    if (Option.isNone(participantStateOpt)) {
      yield* Effect.logWarning("Missing initialized participant state", {
        key,
      })
      return
    }

    if (getUploadSessionId(participantStateOpt.value) !== uploadSessionId) {
      yield* Effect.logWarning("Submission belongs to a stale upload session", {
        key,
      })
      return
    }

    if (submissionStateOpt.value.uploaded) {
      yield* Effect.logWarning("Submission already uploaded, continuing finalization")
    } else {
      const fileOpt = yield* s3.getFile(config.submissionsBucketName, key)
      if (Option.isNone(fileOpt)) {
        return yield* Effect.fail(
          new UploadProcessorError({
            message: "Photo not found",
            details: JSON.stringify({ domain, reference, orderIndex, key }),
          }),
        )
      }
      const photo = fileOpt.value

      const existingExifState = yield* exifKv.getExifState(domain, reference, orderIndex)
      const seededExif = Option.filter(existingExifState, hasExifFields)

      const [exifResult, thumbnailResult] = yield* Effect.all(
        [
          processExif(photo, domain, reference, orderIndex, seededExif),
          generateThumbnail(photo, domain, reference, orderIndex, fileName),
        ],
        { concurrency: 2 },
      )

      yield* uploadKv
        .updateSubmissionSession(domain, reference, orderIndex, {
          uploaded: true,
          orderIndex,
          thumbnailKey: Option.getOrNull(thumbnailResult),
          exifProcessed: Option.isSome(exifResult),
        })
        .pipe(
          Effect.tapError((error) => Effect.logError("Failed to update submission state", error)),
        )
    }

    const { status } = yield* uploadKv
      .incrementParticipantState(domain, reference, orderIndex)
      .pipe(
        Effect.catch((error) =>
          Effect.fail(
            new UploadProcessorError({
              message: "Failed to increment participant state",
              cause: error,
              details: JSON.stringify({
                domain,
                reference,
                orderIndex,
                key,
              }),
            }),
          ),
        ),
      )

    if (status === "FINALIZED" || status === "ALREADY_FINALIZED") {
      const currentParticipantStateOpt = yield* uploadKv.getParticipantState(domain, reference)

      if (
        Option.isNone(currentParticipantStateOpt) ||
        getUploadSessionId(currentParticipantStateOpt.value) !== uploadSessionId
      ) {
        yield* Effect.logWarning("Skipping finalized event for stale upload session", {
          key,
          uploadSessionId,
        })
        return
      }

      yield* bus.sendFinalizedEvent(domain, reference, uploadSessionId)
    }
  },
  (effect, param) => Effect.annotateLogs(effect, { ...param }),
)

export const UploadProcessorLive = Layer.mergeAll(
  UploadProcessorConfig.layer,
  S3Service.layer,
  UploadSessionRepository.layer,
  ExifKVRepository.layer,
  ExifParser.layer,
  BusService.layer,
  SharpImageService.layer,
)
