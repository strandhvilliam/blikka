import { Effect, Option } from "effect"
import { S3Service } from "@blikka/s3"
import { ExifKVRepository, ExifState, UploadKVRepository } from "@blikka/kv-store"
import { ThumbnailService } from "./thumbnail-service"
import { ExifParser } from "@blikka/exif-parser"
import { BusService } from "@blikka/bus"
import { Database } from "@blikka/db"
import { parseKey } from "./utils"
import { Resource as SSTResource } from "sst"
import { FailedToIncrementParticipantStateError, PhotoNotFoundError } from "./errors"
import { RunStateService } from "@blikka/pubsub"

export class UploadProcessorService extends Effect.Service<UploadProcessorService>()(
  "@blikka/tasks/UploadProcessorService",
  {
    dependencies: [
      S3Service.Default,
      UploadKVRepository.Default,
      ExifKVRepository.Default,
      ExifParser.Default,
      BusService.Default,
      Database.Default,
      ThumbnailService.Default,
      RunStateService.Default,
    ],
    effect: Effect.gen(function* () {
      const s3 = yield* S3Service
      const uploadKv = yield* UploadKVRepository
      const exifKv = yield* ExifKVRepository
      const exifParser = yield* ExifParser
      const bus = yield* BusService
      const thumbnailService = yield* ThumbnailService

      const handleParticipantError = Effect.fnUntraced(
        function* (domain: string, reference: string, errorCode: string, error: Error) {
          yield* Effect.logError(error.message, { domain, reference, errorCode })
          return yield* uploadKv
            .setParticipantErrorState(domain, reference, errorCode)
            .pipe(Effect.andThen(() => Effect.logError(error.message, error.cause)))
        },
        Effect.catchAll((error) => Effect.logError("Failed to set participant error state", error))
      )

      const processPhoto = Effect.fn("UploadProcessorService.processPhoto")(function* (
        key: string
      ) {
        const { domain, reference, orderIndex } = yield* parseKey(key)

        const submissionStateOpt = yield* uploadKv.getSubmissionState(domain, reference, orderIndex)
        if (Option.isSome(submissionStateOpt) && submissionStateOpt.value.uploaded) {
          yield* Effect.logWarning("Submission already uploaded, skipping")
          return
        }

        const photo = yield* s3.getFile(SSTResource.V2SubmissionsBucket.name, key).pipe(
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

        const thumbnailResult = yield* thumbnailService
          .generateThumbnail(Buffer.from(photo), key)
          .pipe(
            Effect.map(Option.some),
            Effect.catchAll((error) =>
              handleParticipantError(domain, reference, "THUMBNAIL_ERROR", error).pipe(
                Effect.as(Option.none<string>())
              )
            )
          )

        yield* uploadKv
          .updateSubmissionState(domain, reference, orderIndex, {
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
) {}
