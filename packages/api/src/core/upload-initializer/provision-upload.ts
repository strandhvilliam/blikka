import { Config, Context, Effect, Layer } from 'effect'
import { DbError, DbLayer, SubmissionsRepository, type Topic } from '@blikka/db'
import { S3ClientError, S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  ExifKVRepository,
  ExifKVRepositoryLayer,
  type ExifKVRepositoryError,
  type InvalidKeyFormatError,
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'

import { createUploadSessionId } from './utils'

function hasExifFields(
  exif: Record<string, unknown> | null | undefined,
): exif is Record<string, unknown> {
  return exif !== null && exif !== undefined && Object.keys(exif).length > 0
}

export interface ResetAndSeedUploadExifParams {
  domain: string
  reference: string
  staleOrderIndexes: readonly number[]
  orderIndexes: readonly number[]
  uploadExif?: readonly (Record<string, unknown> | null)[] | undefined
}

export interface ProvisionSingleByCameraUploadParams {
  domain: string
  reference: string
  participantId: number
  marathonId: number
  activeTopic: Topic
  resolvedContentType: string
  staleOrderIndexes: readonly number[]
  uploadExif?: readonly (Record<string, unknown> | null)[] | undefined
}

export type UploadProvisionerError =
  | DbError
  | S3ClientError
  | UploadSessionRepositoryError
  | InvalidKeyFormatError
  | ExifKVRepositoryError

export class UploadProvisionerService extends Context.Service<
  UploadProvisionerService,
  {
    readonly resetAndSeedUploadExif: (
      input: ResetAndSeedUploadExifParams,
    ) => Effect.Effect<void, UploadProvisionerError>
    readonly provisionSingleByCameraUpload: (
      input: ProvisionSingleByCameraUploadParams,
    ) => Effect.Effect<
      {
        participantId: number
        reference: string
        uploadSessionId: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      UploadProvisionerError
    >
  }
>()('@blikka/api/UploadProvisionerService') {}

const makeUploadProvisionerService = Effect.gen(function* () {
  const exifKv = yield* ExifKVRepository
  const s3 = yield* S3Service
  const submissionsRepository = yield* SubmissionsRepository
  const kv = yield* UploadSessionRepository
  const bucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')

  const resetAndSeedUploadExif: UploadProvisionerService['Service']['resetAndSeedUploadExif'] =
    Effect.fn('UploadProvisionerService.resetAndSeedUploadExif')(function* ({
      domain,
      reference,
      staleOrderIndexes,
      orderIndexes,
      uploadExif,
    }: ResetAndSeedUploadExifParams) {
      const orderIndexesToClear = [...new Set([...staleOrderIndexes, ...orderIndexes])]

      yield* exifKv.deleteExifStates(domain, reference, orderIndexesToClear)

      if (uploadExif === undefined) {
        return
      }

      const exifEntries = orderIndexes.flatMap((orderIndex, index) => {
        const exif = uploadExif[index]
        return hasExifFields(exif) ? [{ orderIndex, exif }] : []
      })

      yield* Effect.forEach(
        exifEntries,
        ({ orderIndex, exif }) => exifKv.setExifState(domain, reference, orderIndex, exif),
        { concurrency: 'unbounded' },
      )
    })

  const provisionSingleByCameraUpload: UploadProvisionerService['Service']['provisionSingleByCameraUpload'] =
    Effect.fn('UploadProvisionerService.provisionSingleByCameraUpload')(function* ({
      domain,
      reference,
      participantId,
      marathonId,
      activeTopic,
      resolvedContentType,
      staleOrderIndexes,
      uploadExif,
    }: ProvisionSingleByCameraUploadParams) {
      const submissionKey = yield* s3.generateSubmissionKey(
        domain,
        reference,
        activeTopic.orderIndex,
        {
          contentType: resolvedContentType,
        },
      )

      yield* submissionsRepository.createSubmission({
        data: {
          participantId,
          key: submissionKey,
          marathonId,
          topicId: activeTopic.id,
          status: 'initialized',
        },
      })

      const uploadSessionId = createUploadSessionId()
      yield* kv.initializeState(domain, reference, uploadSessionId, [submissionKey])
      yield* resetAndSeedUploadExif({
        domain,
        reference,
        staleOrderIndexes,
        orderIndexes: [activeTopic.orderIndex],
        uploadExif,
      })

      const presignedUrl = yield* s3.getPresignedUrl(bucketName, submissionKey, 'PUT', {
        contentType: resolvedContentType,
      })

      return {
        participantId,
        reference,
        uploadSessionId,
        uploads: [
          {
            key: submissionKey,
            url: presignedUrl,
            contentType: resolvedContentType,
          },
        ],
      }
    })

  return UploadProvisionerService.of({
    resetAndSeedUploadExif,
    provisionSingleByCameraUpload,
  })
})

export const UploadProvisionerServiceLayerNoDeps = Layer.effect(
  UploadProvisionerService,
  makeUploadProvisionerService,
)

export const UploadProvisionerServiceLayer = UploadProvisionerServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(DbLayer, S3ServiceLayer, UploadSessionRepositoryLayer, ExifKVRepositoryLayer),
  ),
)
