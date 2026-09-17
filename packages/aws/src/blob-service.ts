import { del, get, head, put } from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { Config, Effect, Layer, Option } from 'effect'
import { createSubmissionObjectKey, S3ClientError, S3Service } from './s3-contract'
import { buildBlobUrl } from './storage-url'

const makeBlobService = Effect.gen(function* () {
  const token = yield* Config.string('BLOB_READ_WRITE_TOKEN')
  const callbackOrigin = yield* Config.string('BLOB_CALLBACK_ORIGIN')
  yield* Config.string('NEXT_PUBLIC_BLOB_BASE_URL')
  const submissionsBucket = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
  const pathname = (bucket: string, key: string) => `${bucket}/${key}`
  const run = <A>(operation: () => Promise<A>) =>
    Effect.tryPromise({
      try: operation,
      catch: (cause) => new S3ClientError({ message: 'Blob storage operation failed', cause }),
    })

  return S3Service.of({
    getFile: (bucket, key) =>
      run(async () => {
        const blob = await get(pathname(bucket, key), { token, access: 'public', useCache: false })
        if (!blob) return Option.none<Uint8Array>()
        if (blob.statusCode !== 200) throw new Error('Unexpected conditional Blob response')
        return Option.some(new Uint8Array(await new Response(blob.stream).arrayBuffer()))
      }),
    getHead: (bucket, key) =>
      run(async () => {
        const blob = await head(pathname(bucket, key), { token })
        return {
          $metadata: {},
          ContentLength: blob.size,
          ContentType: blob.contentType,
          LastModified: blob.uploadedAt,
          ETag: blob.etag,
        }
      }),
    getPresignedUrl: (bucket, key, method, options) =>
      run(async () => {
        if (method === 'GET') {
          const url = buildBlobUrl(bucket, key)
          if (!url) throw new Error('NEXT_PUBLIC_BLOB_BASE_URL is required')
          return url
        }
        const path = pathname(bucket, key)
        const clientToken = await generateClientTokenFromReadWriteToken({
          token,
          pathname: path,
          validUntil: Date.now() + Math.min(options?.expiresIn ?? 3600, 86400) * 1000,
          maximumSizeInBytes: bucket === submissionsBucket ? 150 * 1024 * 1024 : 10 * 1024 * 1024,
          allowedContentTypes: options?.contentType
            ? [options.contentType]
            : ['image/*', 'text/markdown', 'text/plain'],
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
          ...(bucket === submissionsBucket
            ? {
                onUploadCompleted: {
                  callbackUrl: new URL('/api/blob/upload', callbackOrigin).toString(),
                  tokenPayload: JSON.stringify({ bucket, key }),
                },
              }
            : {}),
        })
        return `blob-upload:${encodeURIComponent(JSON.stringify({ pathname: path, token: clientToken }))}`
      }),
    putFile: (bucket, key, file) =>
      run(async () => {
        const blob = await put(pathname(bucket, key), file, {
          token,
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
        })
        return { $metadata: {}, ETag: blob.etag }
      }),
    uploadStream: (bucket, key, body, options) =>
      run(async () => {
        await put(pathname(bucket, key), body, {
          token,
          access: 'public',
          multipart: true,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: options?.contentType,
          cacheControlMaxAge: 60,
        })
      }),
    deleteFile: (bucket, key) =>
      run(async () => {
        await del(pathname(bucket, key), { token })
        return { $metadata: {} }
      }),
    generateSubmissionKey: (domain, reference, orderIndex, options) =>
      Effect.sync(() => createSubmissionObjectKey({ domain, reference, orderIndex, ...options })),
  })
})

export const BlobServiceLayer = Layer.effect(S3Service, makeBlobService)
