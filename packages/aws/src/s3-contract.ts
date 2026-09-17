import type {
  DeleteObjectCommandOutput,
  HeadObjectCommandOutput,
  PutObjectCommandOutput,
} from '@aws-sdk/client-s3'
import { Effect, Option, Schema, Context } from 'effect'
import type { Readable } from 'node:stream'

export class S3ClientError extends Schema.TaggedErrorClass<S3ClientError>()('S3ClientError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

const DEFAULT_SUBMISSION_CONTENT_TYPE = 'image/jpeg'

const SUBMISSION_CONTENT_TYPE_EXTENSION_MAP = {
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

type SupportedSubmissionContentType = keyof typeof SUBMISSION_CONTENT_TYPE_EXTENSION_MAP

export function resolveSubmissionContentType(contentType?: string): SupportedSubmissionContentType {
  if (!contentType) {
    return DEFAULT_SUBMISSION_CONTENT_TYPE
  }

  if (contentType in SUBMISSION_CONTENT_TYPE_EXTENSION_MAP) {
    return contentType as SupportedSubmissionContentType
  }

  return DEFAULT_SUBMISSION_CONTENT_TYPE
}

export function resolveSubmissionExtension(contentType?: string): string {
  const normalizedContentType = resolveSubmissionContentType(contentType)
  return SUBMISSION_CONTENT_TYPE_EXTENSION_MAP[normalizedContentType]
}

export function createSubmissionObjectKey({
  domain,
  reference,
  orderIndex,
  filenamePrefix,
  contentType,
}: {
  domain: string
  reference: string
  orderIndex: number
  filenamePrefix?: string
  contentType?: string
}): string {
  const dateTime = new Date().toISOString().replace(/[:.]/g, '-')
  const formattedOrderIndex = (orderIndex + 1).toString().padStart(2, '0')
  const prefix = filenamePrefix ? `${filenamePrefix}_` : ''
  const extension = resolveSubmissionExtension(contentType)

  return `${domain}/${reference}/${formattedOrderIndex}/${prefix}${reference}_${formattedOrderIndex}_${dateTime}.${extension}`
}

export class S3Service extends Context.Service<
  S3Service,
  {
    /**
     * Get a file from S3.
     */
    readonly getFile: (
      bucket: string,
      key: string,
    ) => Effect.Effect<Option.Option<Uint8Array>, S3ClientError, never>
    /**
     * Get the head of a file from S3.
     */
    readonly getHead: (
      bucket: string,
      key: string,
    ) => Effect.Effect<HeadObjectCommandOutput, S3ClientError, never>
    /**
     * Get a presigned URL for a file from S3.
     */
    readonly getPresignedUrl: (
      bucket: string,
      key: string,
      method: 'GET' | 'PUT',
      options?: { expiresIn?: number; contentType?: string },
    ) => Effect.Effect<string, S3ClientError, never>
    /**
     * Put a file to S3.
     */
    readonly putFile: (
      bucket: string,
      key: string,
      file: Buffer,
    ) => Effect.Effect<PutObjectCommandOutput, S3ClientError, never>
    /**
     * Stream a body to S3 via multipart upload (lib-storage), so large objects never need to be
     * fully buffered in memory. The body is consumed as it is produced, with backpressure.
     */
    readonly uploadStream: (
      bucket: string,
      key: string,
      body: Readable,
      options?: { contentType?: string },
    ) => Effect.Effect<void, S3ClientError, never>
    /**
     * Delete a file from S3.
     */
    readonly deleteFile: (
      bucket: string,
      key: string,
    ) => Effect.Effect<DeleteObjectCommandOutput, S3ClientError, never>
    /**
     * Generate a submission key for a file.
     */
    readonly generateSubmissionKey: (
      domain: string,
      reference: string,
      orderIndex: number,
      options?: { filenamePrefix?: string; contentType?: string },
    ) => Effect.Effect<string, S3ClientError, never>
  }
>()('@blikka/aws/s3-service') {}
