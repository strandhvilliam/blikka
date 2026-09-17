import { afterEach, expect, it, vi } from 'vitest'
import { Effect, Layer } from 'effect'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})
it('constructs all selected infrastructure layers without AWS credentials or region', async () => {
  vi.stubEnv('DEPLOYMENT_PROFILE', 'vercel-by-camera')
  vi.stubEnv('SMS_PROVIDER', 'twilio')
  vi.stubEnv('AWS_REGION', undefined)
  vi.stubEnv('AWS_ACCESS_KEY_ID', undefined)
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', undefined)
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
  vi.stubEnv('BLOB_CALLBACK_ORIGIN', 'https://blikka.app')
  vi.stubEnv('NEXT_PUBLIC_BLOB_BASE_URL', 'https://test.public.blob.vercel-storage.com')
  vi.stubEnv('SUBMISSIONS_BUCKET_NAME', 'submissions')
  vi.stubEnv('THUMBNAILS_BUCKET_NAME', 'thumbnails')
  vi.resetModules()
  const aws = await import('./index')
  const layer = Layer.mergeAll(
    aws.S3ServiceLayer,
    aws.SQSServiceLayer,
    aws.SMSServiceLayer,
    aws.BusServiceLayer,
    aws.EcsTaskRunnerServiceLayer,
  )
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const s3 = yield* aws.S3Service
      yield* aws.SQSService
      yield* aws.SMSService
      yield* aws.BusService
      yield* aws.EcsTaskRunnerService
      return yield* s3.getPresignedUrl('submissions', 'demo/ref/01/photo.jpg', 'GET')
    }).pipe(Effect.provide(layer)),
  )
  expect(result).toBe(
    'https://test.public.blob.vercel-storage.com/submissions/demo/ref/01/photo.jpg',
  )
})
