import { Cause, Effect, Layer, Option, ServiceMap } from "effect"
import { S3Service } from "@blikka/aws"
import { ExifKVRepository, ExifState, UploadSessionRepository } from "@blikka/kv-store"
import { ExifParser } from "@blikka/image-manipulation"
import { BusService } from "@blikka/aws"
import { makeThumbnailKey } from "./utils"
import { FailedToIncrementParticipantStateError, PhotoNotFoundError } from "./errors"
import { SharpImageService } from "@blikka/image-manipulation/sharp"
import { Resource as SSTResource } from "sst"
import { hasExifFields, mergeExifStates } from "./exif-utils"

const THUMBNAIL_WIDTH = 400

export interface ProcessPhotoParams {
  key: string
  domain: string
  reference: string
  orderIndex: number
  fileName: string
}

export class UploadProcessorService extends ServiceMap.Service<UploadProcessorService>()(
  "@blikka/upload-processor/UploadProcessorService",
  {
    make: Effect.gen(function* () {
      const s3 = yield* S3Service
      const uploadKv = yield* UploadSessionRepository
      const exifKv = yield* ExifKVRepository
      const exifParser = yield* ExifParser
      const bus = yield* BusService
      const sharp = yield* SharpImageService

      const thumbnailsBucketName = SSTResource.V2ThumbnailsBucket.name
      const submissionsBucketName = SSTResource.V2SubmissionsBucket.name

      const generateThumbnail = Effect.fn("UploadProcessorService.generateThumbnail")(function* (
        photo: Uint8Array<ArrayBufferLike>,
        parsedKey: {
          domain: string
          reference: string
          orderIndex: number
          fileName: string
        },
      ) {
        const thumbnailKey = makeThumbnailKey(parsedKey)

        const resized = yield* sharp.resize(photo, {
          width: THUMBNAIL_WIDTH,
        })
        yield* s3.putFile(thumbnailsBucketName, thumbnailKey, resized)
        return thumbnailKey
      })

      const processPhoto = Effect.fn("UploadProcessorService.processPhoto")(function* (
        params: ProcessPhotoParams,
      ) {
        const { key, domain, reference, orderIndex, fileName } = params

        return yield* Effect.gen(function* () {
          const submissionStateOpt = yield* uploadKv.getSubmissionState(
            domain,
            reference,
            orderIndex,
          )
          if (Option.isNone(submissionStateOpt)) {
            yield* Effect.logWarning("Missing initialized submission state", {
              key,
            })
            return
          }

          if (submissionStateOpt.value.key !== key) {
            yield* Effect.logWarning("Uploaded key does not match initialized submission key", {
              key,
            })
            return
          }

          if (submissionStateOpt.value.uploaded) {
            yield* Effect.logWarning("Submission already uploaded, skipping", { key })
            return
          }

          const photo = yield* s3.getFile(submissionsBucketName, key).pipe(
            Effect.andThen(
              Option.match({
                onSome: (photo) => Effect.succeed(photo),
                onNone: () =>
                  Effect.fail(
                    new PhotoNotFoundError({
                      message: "Photo not found",
                      details: JSON.stringify({
                        domain,
                        reference,
                        orderIndex,
                        key,
                      }),
                    }),
                  ),
              }),
            ),
          )

          const existingExifState = yield* exifKv.getExifState(domain, reference, orderIndex)
          const seededExif = Option.filter(existingExifState, hasExifFields)

          const [exifResult, thumbnailResult] = yield* Effect.all(
            [
              Option.match(seededExif, {
                onSome: (seededExifState) =>
                  exifParser.parse(photo).pipe(
                    Effect.flatMap((parsedExif) => {
                      const mergedExif = mergeExifStates(seededExifState, parsedExif)
                      return exifKv
                        .setExifState(domain, reference, orderIndex, mergedExif)
                        .pipe(Effect.as(Option.some(mergedExif)))
                    }),
                    Effect.catchCause((cause) =>
                      Effect.gen(function* () {
                        yield* Effect.logWarning(
                          "EXIF parse or merge persist failed; keeping seeded EXIF",
                          {
                            domain,
                            reference,
                            orderIndex,
                            key,
                            cause: Cause.pretty(cause),
                          },
                        )
                        return Option.some<ExifState>(seededExifState)
                      }),
                    ),
                  ),
                onNone: () =>
                  exifParser.parse(photo).pipe(
                    Effect.tap((exif) => exifKv.setExifState(domain, reference, orderIndex, exif)),
                    Effect.map(Option.some),
                    Effect.catchCause((cause) =>
                      Effect.gen(function* () {
                        yield* Effect.logWarning(
                          "EXIF parse or persist failed; continuing without EXIF (can retry later)",
                          {
                            domain,
                            reference,
                            orderIndex,
                            key,
                            cause: Cause.pretty(cause),
                          },
                        )
                        return Option.none<ExifState>()
                      }),
                    ),
                  ),
              }),
              generateThumbnail(photo, {
                domain,
                reference,
                orderIndex,
                fileName,
              }).pipe(
                Effect.map(Option.some),
                Effect.catchCause((cause) =>
                  Effect.gen(function* () {
                    yield* Effect.logWarning(
                      "Thumbnail generation or upload failed; continuing without thumbnail (can retry later)",
                      {
                        domain,
                        reference,
                        orderIndex,
                        key,
                        cause: Cause.pretty(cause),
                      },
                    )
                    return Option.none<string>()
                  }),
                ),
              ),
            ],
            { concurrency: 2 },
          )

          yield* uploadKv
            .updateSubmissionSession(domain, reference, orderIndex, {
              uploaded: true,
              orderIndex: Number(orderIndex),
              thumbnailKey: Option.getOrNull(thumbnailResult),
              exifProcessed: Option.isSome(exifResult),
            })
            .pipe(
              Effect.catch((error) => Effect.logError("Failed to update submission state", error)),
            )

          const { finalize } = yield* uploadKv
            .incrementParticipantState(domain, reference, orderIndex)
            .pipe(
              Effect.catch((error) =>
                Effect.fail(
                  new FailedToIncrementParticipantStateError({
                    cause: error,
                    message: "Failed to increment participant state",
                  }),
                ),
              ),
            )

          if (finalize) {
            yield* bus.sendFinalizedEvent(domain, reference)
          }
        }).pipe(Effect.annotateLogs({ domain, reference, orderIndex, key }))
      })

      return {
        processPhoto,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        S3Service.layer,
        UploadSessionRepository.layer,
        ExifKVRepository.layer,
        ExifParser.layer,
        BusService.layer,
        SharpImageService.layer,
      ),
    ),
  )
}
