import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { BlobServiceLayer } from './blob-service'
import { S3Service } from './s3-contract'
import { buildBlobUrl } from './storage-url'
const { generateToken } = vi.hoisted(() => ({
  generateToken: vi.fn().mockResolvedValue('client-token'),
}))
vi.mock('@vercel/blob/client', () => ({ generateClientTokenFromReadWriteToken: generateToken }))
beforeEach(() => {
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
  vi.stubEnv('BLOB_CALLBACK_ORIGIN', 'https://blikka.app')
  vi.stubEnv('NEXT_PUBLIC_BLOB_BASE_URL', 'https://test.public.blob.vercel-storage.com')
  vi.stubEnv('SUBMISSIONS_BUCKET_NAME', 'submissions')
  vi.stubEnv('THUMBNAILS_BUCKET_NAME', 'thumbnails')
  generateToken.mockClear()
})
afterEach(() => vi.unstubAllEnvs())
describe('Blob storage adapter', () => {
  it('scopes upload tokens to the requested object and sets explicit limits and expiry', async () => {
    const before = Date.now()
    const descriptor = await Effect.runPromise(
      S3Service.use((s3) =>
        s3.getPresignedUrl('submissions', 'demo/ref/01/image.jpg', 'PUT', {
          contentType: 'image/jpeg',
        }),
      ).pipe(Effect.provide(BlobServiceLayer)),
    )
    expect(descriptor.startsWith('blob-upload:')).toBe(true)
    const options = generateToken.mock.calls[0]![0]
    expect(options).toMatchObject({
      pathname: 'submissions/demo/ref/01/image.jpg',
      maximumSizeInBytes: 150 * 1024 * 1024,
      allowedContentTypes: ['image/jpeg'],
      addRandomSuffix: false,
      onUploadCompleted: {
        callbackUrl: 'https://blikka.app/api/blob/upload',
        tokenPayload: JSON.stringify({ bucket: 'submissions', key: 'demo/ref/01/image.jpg' }),
      },
    })
    expect(options.validUntil).toBeGreaterThanOrEqual(before + 3600000)
  })
  it('does not enqueue logo or terms uploads for photo processing', async () => {
    await Effect.runPromise(
      S3Service.use((s3) =>
        s3.getPresignedUrl('settings', 'demo/terms.txt', 'PUT', { contentType: 'text/plain' }),
      ).pipe(Effect.provide(BlobServiceLayer)),
    )
    expect(generateToken.mock.calls[0]![0].onUploadCompleted).toBeUndefined()
  })
  it('encodes keys as path segments, including logo version characters', () => {
    expect(buildBlobUrl('settings', 'demo/logo?v=2')).toBe(
      'https://test.public.blob.vercel-storage.com/settings/demo/logo%3Fv%3D2',
    )
  })
})
