import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { Duration, Effect, Option, Schedule, Layer } from 'effect'
import type { Readable } from 'node:stream'
import { Upload } from '@aws-sdk/lib-storage'
import { S3EffectClient, S3EffectClientLayer } from './clients/s3-effect-client'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export * from './s3-contract'
import {
  S3ClientError,
  S3Service,
  createSubmissionObjectKey,
  resolveSubmissionContentType,
} from './s3-contract'
import { BlobServiceLayer } from './blob-service'
import { isVercelByCamera } from './deployment'

const makeS3Service = Effect.gen(function* () {
  const s3Client = yield* S3EffectClient

  const getFile = Effect.fn('S3Service.getFile')(
    function* (bucket: string, key: string) {
      const file = yield* s3Client.use((client) =>
        client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
      )

      if (!file.Body) {
        return Option.none<Uint8Array>()
      }
      const body = file.Body

      const buffer = yield* Effect.tryPromise({
        try: () => body.transformToByteArray(),
        catch: (error) =>
          new S3ClientError({
            cause: error,
            message: 'Failed to transform to byte array',
          }),
      })
      return Option.some<Uint8Array>(buffer)
    },
    Effect.mapError((error) => {
      return new S3ClientError({
        cause: error,
        message: 'Unexpected S3 error',
      })
    }),
  )

  const getHead = Effect.fn('S3Service.getHead')(
    function* (bucket: string, key: string) {
      const head = yield* s3Client.use((client) =>
        client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
      )
      return head
    },
    Effect.mapError((error) => {
      return new S3ClientError({
        cause: error,
        message: 'Unexpected S3 error',
      })
    }),
  )

  const getPresignedUrl = Effect.fn('S3Service.getPresignedUrl')(
    function* (
      bucket: string,
      key: string,
      method: 'GET' | 'PUT' = 'GET',
      options?: { expiresIn?: number; contentType?: string },
    ) {
      const command =
        method === 'GET'
          ? new GetObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          : new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              ContentType: resolveSubmissionContentType(options?.contentType),
            })

      return yield* s3Client.use((client) =>
        getSignedUrl(client, command, {
          expiresIn: options?.expiresIn ?? 60 * 60 * 24,
        }),
      )
    },
    Effect.mapError((error) => {
      return new S3ClientError({
        cause: error,
        message: 'Unexpected S3 error',
      })
    }),
  )

  const putFile = Effect.fn('S3Service.putFile')(
    function* (bucket: string, key: string, file: Buffer) {
      const putObjectCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
      })
      return yield* s3Client.use((client) => client.send(putObjectCommand))
    },
    Effect.retry(Schedule.max([Schedule.exponential(Duration.millis(100)), Schedule.recurs(3)])),
    Effect.mapError((error) => {
      return new S3ClientError({
        cause: error,
        message: 'Unexpected S3 error',
      })
    }),
  )

  const uploadStream = Effect.fn('S3Service.uploadStream')(
    function* (bucket: string, key: string, body: Readable, options?: { contentType?: string }) {
      yield* s3Client.use((client) =>
        new Upload({
          client,
          params: {
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: options?.contentType,
          },
        }).done(),
      )
    },
    Effect.mapError((error) => {
      return new S3ClientError({
        cause: error,
        message: 'Unexpected S3 error',
      })
    }),
  )

  const deleteFile = Effect.fn('S3Service.deleteFile')(
    function* (bucket: string, key: string) {
      const deleteObjectCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
      return yield* s3Client.use((client) => client.send(deleteObjectCommand))
    },
    Effect.retry(Schedule.max([Schedule.exponential(Duration.millis(100)), Schedule.recurs(3)])),
    Effect.mapError((error) => {
      return new S3ClientError({
        cause: error,
        message: 'Unexpected S3 error',
      })
    }),
  )

  const generateSubmissionKey = Effect.fnUntraced(function* (
    domain: string,
    reference: string,
    orderIndex: number,
    options?: {
      filenamePrefix?: string
      contentType?: string
    },
  ) {
    return createSubmissionObjectKey({
      domain,
      reference,
      orderIndex,
      filenamePrefix: options?.filenamePrefix,
      contentType: options?.contentType,
    })
  })

  return S3Service.of({
    getFile,
    getHead,
    getPresignedUrl,
    putFile,
    uploadStream,
    deleteFile,
    generateSubmissionKey,
  })
})

export const S3ServiceLayerNoDeps = Layer.effect(S3Service, makeS3Service)

export const S3ServiceLayer = isVercelByCamera()
  ? BlobServiceLayer
  : S3ServiceLayerNoDeps.pipe(Layer.provide(S3EffectClientLayer))
