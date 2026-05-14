import { Cause, Effect, Layer, Option, ServiceMap } from "effect"
import { BusService, S3Service } from "@blikka/aws"
import {
  ExifKVRepository,
  type ExifState,
  type SubmissionState,
  UploadSessionRepository,
} from "@blikka/kv-store"
import { ExifParser, SharpImageService } from "@blikka/image-manipulation"
import { UploadsConfig } from "./config"
import { PhotoNotFoundError, type SubmissionProcessorError } from "./errors"

const THUMBNAIL_WIDTH = 400

function hasExifFields(exif: ExifState | null | undefined): exif is ExifState {
  return exif !== null && exif !== undefined && Object.keys(exif).length > 0
}

function mergeExifStates(preferredExif: ExifState, parsedExif: ExifState): ExifState {
  return {
    ...parsedExif,
    ...preferredExif,
  }
}

function makeThumbnailKey(params: {
  readonly domain: string
  readonly reference: string
  readonly orderIndex: number
  readonly fileName: string
}): string {
  const formattedOrderIndex = (params.orderIndex + 1).toString().padStart(2, "0")
  return `${params.domain}/${params.reference}/${formattedOrderIndex}/thumbnail_${params.fileName}`
}

export interface ProcessSubmissionInput {
  readonly key: string
  readonly domain: string
  readonly reference: string
  readonly orderIndex: number
  readonly fileName: string
}

export interface SubmissionProcessorShape {
  /**
   * Processes a submission normally triggered by S3 created event.
   * Expects submission state to be initialized in KV store.
   * Will send finalized event to bus if all photos are processed.
   */
  readonly process: (
    params: ProcessSubmissionInput,
  ) => Effect.Effect<void, SubmissionProcessorError>
}

export class SubmissionProcessor extends ServiceMap.Service<
  SubmissionProcessor,
  SubmissionProcessorShape
>()("@blikka/uploads/SubmissionProcessor") {}

/** Submission + KV checks passed; safe to ingest photo and advance counters. */
interface ReadySubmissionContext {
  readonly params: ProcessSubmissionInput
  readonly submission: SubmissionState
  readonly uploadSessionId: string
}

const makeSubmissionProcessor = Effect.gen(function* () {
  const s3 = yield* S3Service
  const uploadKv = yield* UploadSessionRepository
  const exifKv = yield* ExifKVRepository
  const exifParser = yield* ExifParser
  const bus = yield* BusService
  const config = yield* UploadsConfig
  const sharp = yield* SharpImageService

  const generateThumbnail = Effect.fnUntraced(
    function* (
      photo: Uint8Array<ArrayBufferLike>,
      domain: string,
      reference: string,
      orderIndex: number,
      fileName: string,
    ) {
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
    return yield* Effect.catchCause(
      Effect.gen(function* () {
        const parsedExif = yield* exifParser.parse(photo)
        const exif = Option.match(seededExif, {
          onSome: (seededExifState) => mergeExifStates(seededExifState, parsedExif),
          onNone: () => parsedExif,
        })
        yield* exifKv.setExifState(domain, reference, orderIndex, exif)
        return Option.some(exif)
      }),
      (cause) =>
        Effect.gen(function* () {
          if (Option.isSome(seededExif)) {
            return Option.some(seededExif.value)
          }
          yield* Effect.logWarning(
            "EXIF parse or persist failed; continuing without EXIF (can retry later)",
            { cause: Cause.pretty(cause) },
          )
          return Option.none<ExifState>()
        }),
    )
  })

  const resolveReadySubmissionContext = Effect.fnUntraced(function* (
    params: ProcessSubmissionInput,
  ) {
    const { key, domain, reference, orderIndex } = params

    const submissionStateOpt = yield* uploadKv.getSubmissionState(domain, reference, orderIndex)
    if (Option.isNone(submissionStateOpt)) {
      yield* Effect.logWarning("Missing initialized submission state", { key })
      return Option.none<ReadySubmissionContext>()
    }

    if (submissionStateOpt.value.key !== key) {
      yield* Effect.logWarning("Uploaded key does not match initialized submission key", { key })
      return Option.none<ReadySubmissionContext>()
    }

    const uploadSessionId = submissionStateOpt.value.uploadSessionId ?? ""

    const participantStateOpt = yield* uploadKv.getParticipantState(domain, reference)
    if (Option.isNone(participantStateOpt)) {
      yield* Effect.logWarning("Missing initialized participant state", { key })
      return Option.none<ReadySubmissionContext>()
    }

    if (participantStateOpt.value.uploadSessionId !== uploadSessionId) {
      yield* Effect.logWarning("Submission belongs to a stale upload session", { key })
      return Option.none<ReadySubmissionContext>()
    }

    return Option.some<ReadySubmissionContext>({
      params,
      submission: submissionStateOpt.value,
      uploadSessionId,
    })
  })

  const runPhotoArtifactPass = Effect.fnUntraced(function* (ctx: ReadySubmissionContext) {
    const { params, submission } = ctx
    const { key, domain, reference, orderIndex, fileName } = params

    if (submission.uploaded) {
      yield* Effect.logWarning("Submission already uploaded, continuing finalization")
      return
    }

    const fileOpt = yield* s3.getFile(config.submissionsBucketName, key).pipe(
      Effect.mapError((error) => {
        return new PhotoNotFoundError({
          message: "Failed to get photo from submissions bucket",
          cause: error,
          key,
        })
      }),
    )

    if (Option.isNone(fileOpt)) {
      return yield* Effect.fail(
        new PhotoNotFoundError({
          message: "Photo does not exist in submissions bucket",
          key,
        }),
      )
    }
    const photo = fileOpt.value

    const existingExifState = yield* exifKv.getExifState(domain, reference, orderIndex).pipe(
      Effect.catchCause((error) =>
        Effect.logWarning("Failed to get exif state. Continuing without EXIF.", {
          cause: Cause.pretty(error),
          key,
        }),
      ),
      Effect.as(Option.none<ExifState>()),
    )
    const seededExif = Option.filter(existingExifState, hasExifFields)

    const [exifResult, thumbnailResult] = yield* Effect.all(
      [
        processExif(photo, domain, reference, orderIndex, seededExif),
        generateThumbnail(photo, domain, reference, orderIndex, fileName),
      ],
      { concurrency: 2 },
    )

    yield* uploadKv.updateSubmissionSession(domain, reference, orderIndex, {
      uploaded: true,
      orderIndex,
      thumbnailKey: Option.getOrNull(thumbnailResult),
      exifProcessed: Option.isSome(exifResult),
    })
  })

  const incrementParticipantAndMaybeFinalize = Effect.fnUntraced(function* (
    ctx: ReadySubmissionContext,
  ) {
    const { params, uploadSessionId } = ctx
    const { domain, reference, orderIndex, key } = params

    const { status } = yield* uploadKv.incrementParticipantState(domain, reference, orderIndex)

    if (status !== "FINALIZED" && status !== "ALREADY_FINALIZED") {
      return
    }

    const currentParticipantStateOpt = yield* uploadKv.getParticipantState(domain, reference)

    if (
      Option.isNone(currentParticipantStateOpt) ||
      currentParticipantStateOpt.value.uploadSessionId !== uploadSessionId
    ) {
      yield* Effect.logWarning("Skipping finalized event for stale upload session", {
        key,
        uploadSessionId,
      })
      return
    }

    yield* bus.sendFinalizedEvent(domain, reference, uploadSessionId)
  })

  const process = Effect.fn("SubmissionProcessor.process")(
    function* (params: ProcessSubmissionInput) {
      const readyContext = yield* resolveReadySubmissionContext(params)
      if (Option.isNone(readyContext)) return
      yield* runPhotoArtifactPass(readyContext.value)
      yield* incrementParticipantAndMaybeFinalize(readyContext.value)
    },
    (effect, param) => Effect.annotateLogs(effect, { ...param }),
  )

  return { process } satisfies SubmissionProcessorShape
})

export const UploadProcessorLayer = Layer.effect(SubmissionProcessor, makeSubmissionProcessor)
