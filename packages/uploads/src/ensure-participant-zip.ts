import { S3Service, S3ServiceLayer, type S3ClientError } from '@blikka/aws'
import {
  DbLayer,
  ParticipantsRepository,
  TopicsRepository,
  SubmissionsRepository,
  type DbError,
  type Participant,
  type Submission,
  type Topic,
} from '@blikka/db'
import { Context, Effect, Layer, Option, Schema } from 'effect'
import JSZip from 'jszip'
import path from 'path'
import { UploadsConfig, UploadsConfigLayer } from './config'

export class ZipWorkerDataNotFoundError extends Schema.TaggedErrorClass<ZipWorkerDataNotFoundError>()(
  'ZipWorkerDataNotFoundError',
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    key: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class FailedToGenerateZipError extends Schema.TaggedErrorClass<FailedToGenerateZipError>()(
  'FailedToGenerateZipError',
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
  | DbError

export interface EnsureParticipantZipInput {
  readonly domain: string
  readonly reference: string
}

export interface EnsureParticipantZipResult {
  /** S3 key of the participant zip in the zips bucket. */
  readonly key: string
  /** True when the zip was built during this call; false when an existing cached zip was reused. */
  readonly generated: boolean
}

interface ZipEntry {
  readonly path: string
  readonly data: Uint8Array<ArrayBufferLike>
}

export class EnsureParticipantZip extends Context.Service<
  EnsureParticipantZip,
  {
    /**
     * Idempotently ensure a participant's submissions zip exists in the zips bucket.
     *
     * Cache hit (a `zipped_submissions` row AND the S3 object both exist) returns the key
     * without rebuilding. On a miss (or a row without its object), the zip is built from the
     * participant's ORIGINAL submissions, uploaded, and a `zipped_submissions` row is recorded
     * if one does not already exist.
     */
    readonly ensureParticipantZip: (
      input: EnsureParticipantZipInput,
    ) => Effect.Effect<EnsureParticipantZipResult, ZipWorkerError>
  }
>()('@blikka/uploads/EnsureParticipantZip') {}

export function createZipKey(domain: string, reference: string) {
  return `${domain}/${reference}.zip`
}

function createZippedSubmissionDto(domain: string, participant: Participant) {
  return {
    data: {
      marathonId: participant.marathonId,
      participantId: participant.id,
      key: createZipKey(domain, participant.reference),
      exportType: 'zip' as const,
      progress: 100,
      status: 'completed' as const,
      errors: [],
    },
  }
}

function createZipEntryPath(reference: string, submission: Submission, topics: readonly Topic[]) {
  const orderIndex = Option.fromNullishOr(
    topics.find((topic) => topic.id === submission.topicId)?.orderIndex,
  )

  if (Option.isNone(orderIndex)) {
    return Option.none<string>()
  }

  const paddedOrderIndex = String(orderIndex.value + 1).padStart(2, '0')
  const extension = path.extname(submission.key).slice(1) || 'jpg'
  return Option.some(`${reference}_${paddedOrderIndex}.${extension}`)
}

const makeEnsureParticipantZip = Effect.gen(function* () {
  const submissionsRepository = yield* SubmissionsRepository
  const topicsRepository = yield* TopicsRepository
  const participantsRepository = yield* ParticipantsRepository
  const s3 = yield* S3Service
  const config = yield* UploadsConfig

  const buildZipBuffer = Effect.fn('EnsureParticipantZip.buildZipBuffer')(function* (
    domain: string,
    reference: string,
    entries: readonly ZipEntry[],
  ) {
    return yield* Effect.tryPromise({
      try: async () => {
        const zip = new JSZip()
        for (const entry of entries) {
          zip.file(entry.path, entry.data, {
            binary: true,
            compression: 'DEFLATE',
          })
        }
        return zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        })
      },
      catch: (cause) =>
        new FailedToGenerateZipError({
          message: 'Failed to build zip buffer',
          cause,
          domain,
          reference,
        }),
    })
  })

  const processSubmission = Effect.fn('EnsureParticipantZip.processSubmission')(function* (
    domain: string,
    reference: string,
    submission: Submission,
    topics: readonly Topic[],
  ) {
    const zipPath = createZipEntryPath(reference, submission, topics)

    if (Option.isNone(zipPath)) {
      return yield* new ZipWorkerDataNotFoundError({
        message: 'Topic not found',
        domain,
        reference,
        key: submission.key,
      })
    }

    const file = yield* s3.getFile(config.submissionsBucketName, submission.key).pipe(
      Effect.mapError(
        (cause) =>
          new FailedToGenerateZipError({
            message: 'Failed to get file from s3',
            cause,
            domain,
            reference,
          }),
      ),
    )

    if (Option.isNone(file)) {
      return yield* new ZipWorkerDataNotFoundError({
        message: 'File not found',
        domain,
        reference,
        key: submission.key,
      })
    }

    return {
      path: zipPath.value,
      data: file.value,
    } satisfies ZipEntry
  })

  /** True when the zip object already exists in the bucket. NotFound and genuine S3 errors both
   * surface as S3ClientError, so a transient error reads as a cache miss and triggers a rebuild. */
  const zipObjectExists = (zipKey: string) =>
    s3.getHead(config.zipsBucketName, zipKey).pipe(
      Effect.as(true),
      Effect.catch(() => Effect.succeed(false)),
    )

  const buildAndStore = Effect.fn('EnsureParticipantZip.buildAndStore')(function* (
    domain: string,
    reference: string,
    participant: Participant & { submissions: readonly Submission[] },
    hasExistingRow: boolean,
  ) {
    const zipKey = createZipKey(domain, reference)

    const topics = yield* topicsRepository.getTopicsByMarathonId({
      id: participant.marathonId,
    })

    const entries = yield* Effect.forEach(
      participant.submissions,
      (submission) => processSubmission(domain, reference, submission, topics),
      { concurrency: 5 },
    )

    const zipBuffer = yield* buildZipBuffer(domain, reference, entries)
    yield* s3.putFile(config.zipsBucketName, zipKey, zipBuffer)

    // Only record the index row when one does not already exist, so a cache repair (row present
    // but object missing) does not create a duplicate.
    if (!hasExistingRow) {
      const zipDto = createZippedSubmissionDto(domain, participant)
      yield* submissionsRepository.createZippedSubmission(zipDto).pipe(
        Effect.mapError(
          (cause) =>
            new FailedToGenerateZipError({
              domain,
              reference,
              message: 'Failed to save zipped submission to db',
              cause,
            }),
        ),
      )
    }

    return zipKey
  })

  const ensureParticipantZip: EnsureParticipantZip['Service']['ensureParticipantZip'] = Effect.fn(
    'EnsureParticipantZip.ensureParticipantZip',
  )(
    function* ({ domain, reference }: EnsureParticipantZipInput) {
      const zipKey = createZipKey(domain, reference)

      const participantOpt = yield* participantsRepository.getParticipantByReference({
        reference,
        domain,
      })

      if (Option.isNone(participantOpt)) {
        return yield* new ZipWorkerDataNotFoundError({
          message: 'Participant not found',
          domain,
          reference,
        })
      }
      const participant = participantOpt.value

      const hasExistingRow = (participant.zippedSubmissions ?? []).some((zs) => zs.key === zipKey)

      if (hasExistingRow && (yield* zipObjectExists(zipKey))) {
        return { key: zipKey, generated: false } satisfies EnsureParticipantZipResult
      }

      yield* buildAndStore(domain, reference, participant, hasExistingRow)

      return { key: zipKey, generated: true } satisfies EnsureParticipantZipResult
    },
    (effect, input) => Effect.annotateLogs(effect, { ...input }),
  )

  return EnsureParticipantZip.of({ ensureParticipantZip })
})

export const EnsureParticipantZipLayerNoDeps = Layer.effect(
  EnsureParticipantZip,
  makeEnsureParticipantZip,
)

export const EnsureParticipantZipLayer = EnsureParticipantZipLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, S3ServiceLayer, UploadsConfigLayer)),
)
