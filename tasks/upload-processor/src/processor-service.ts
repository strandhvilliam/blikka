import { Config, Effect, Option } from "effect"
import { S3Service } from "@blikka/s3"
import { ExifKVRepository, ExifState, UploadSessionRepository } from "@blikka/kv-store"
import { ExifParser } from "@blikka/exif-parser"
import { BusService } from "@blikka/bus"
import { Database } from "@blikka/db"
import { makeThumbnailKey, parseKey } from "./utils"
import { FailedToIncrementParticipantStateError, PhotoNotFoundError } from "./errors"
import { RunStateService } from "@blikka/pubsub"
import { SharpImageService } from "@blikka/image-manipulation/sharp"

const THUMBNAIL_WIDTH = 400

export class UploadProcessorService extends Effect.Service<UploadProcessorService>()(
  "@blikka/tasks/UploadProcessorService",
  {
    dependencies: [
      S3Service.Default,
      UploadSessionRepository.Default,
      ExifKVRepository.Default,
      ExifParser.Default,
      BusService.Default,
      Database.Default,
      RunStateService.Default,
      SharpImageService.Default,
    ],
    effect: Effect.gen(function*() {
      const s3 = yield* S3Service
      const uploadKv = yield* UploadSessionRepository
      const exifKv = yield* ExifKVRepository
      const exifParser = yield* ExifParser
      const bus = yield* BusService
      const sharp = yield* SharpImageService

      const thumbnailsBucketName = yield* Config.string("THUMBNAILS_BUCKET_NAME")
      const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")

      const handleParticipantError = Effect.fnUntraced(
        function*(domain: string, reference: string, errorCode: string, error: Error) {
          yield* Effect.logError(error.message, { domain, reference, errorCode })
          return yield* uploadKv
            .setParticipantErrorState(domain, reference, errorCode)
            .pipe(Effect.andThen(() => Effect.logError(error.message, error.cause)))
        },
        Effect.catchAll((error) => Effect.logError("Failed to set participant error state", error))
      )

      const generateThumbnail = Effect.fn("ThumbnailService.generateThumbnail")(function*(
        photo: Buffer,
        key: string
      ) {
        const thumbnailKey = yield* parseKey(key).pipe(
          Effect.flatMap((parsedKey) => makeThumbnailKey(parsedKey))
        )

        const resized = yield* sharp.resize(Buffer.from(photo), {
          width: THUMBNAIL_WIDTH,
        })
        yield* s3.putFile(thumbnailsBucketName, thumbnailKey, resized)
        return thumbnailKey
      })

      const processPhoto = Effect.fn("UploadProcessorService.processPhoto")(function*(
        key: string
      ) {
        const { domain, reference, orderIndex } = yield* parseKey(key)

        const submissionStateOpt = yield* uploadKv.getSubmissionState(domain, reference, orderIndex)
        if (Option.isSome(submissionStateOpt) && submissionStateOpt.value.uploaded) {
          yield* Effect.logWarning("Submission already uploaded, skipping")
          return
        }

        const photo = yield* s3.getFile(submissionsBucketName, key).pipe(
          Effect.andThen(
            Option.match({
              onSome: (photo) => Effect.succeed(photo),
              onNone: () =>
                Effect.fail(
                  new PhotoNotFoundError({
                    message: `[${domain}|${reference}|${orderIndex}] Photo not found`,
                    details: JSON.stringify({
                      domain,
                      reference,
                      orderIndex,
                      key,
                    }),
                  })
                ),
            })
          )
        )

        const exifResult = yield* exifParser.parse(Buffer.from(photo)).pipe(
          Effect.tap((exif) => exifKv.setExifState(domain, reference, orderIndex, exif)),
          Effect.map(Option.some),
          Effect.catchAll((error) =>
            handleParticipantError(domain, reference, "EXIF_ERROR", error).pipe(
              Effect.as(Option.none<ExifState>())
            )
          )
        )

        const thumbnailResult = yield* generateThumbnail(Buffer.from(photo), key).pipe(
          Effect.map(Option.some),
          Effect.catchAll((error) =>
            handleParticipantError(domain, reference, "THUMBNAIL_ERROR", error).pipe(
              Effect.as(Option.none<string>())
            )
          )
        )

        yield* uploadKv
          .updateSubmissionSession(domain, reference, orderIndex, {
            uploaded: true,
            orderIndex: Number(orderIndex),
            thumbnailKey: Option.getOrNull(thumbnailResult),
            exifProcessed: Option.isSome(exifResult),
          })
          .pipe(Effect.orElse(() => Effect.logError("Failed to update submission state")))

        const { finalize } = yield* uploadKv
          .incrementParticipantState(domain, reference, orderIndex)
          .pipe(
            Effect.orElseFail(
              () =>
                new FailedToIncrementParticipantStateError({
                  cause: "Failed to increment participant state",
                  message: "Failed to increment participant state",
                })
            )
          )

        if (finalize) {
          yield* bus.sendFinalizedEvent(domain, reference)
        }
      })

      return {
        processPhoto,
      } as const
    }),
  }
) {
}
