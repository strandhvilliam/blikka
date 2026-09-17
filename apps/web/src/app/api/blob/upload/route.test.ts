import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({ messageId: 'job' }) }))
vi.mock('@vercel/queue', () => ({ send }))
const token = 'vercel_blob_rw_test_secret'
const key = 'demo/ABC/01/photo.jpg'
const body = {
  type: 'blob.upload-completed',
  payload: {
    // Deliberately use a different property order than the validation schema.
    tokenPayload: JSON.stringify({ bucket: 'submissions', key }),
    blob: {
      pathname: `submissions/${key}`,
      url: 'https://test.public.blob.vercel-storage.com/photo.jpg',
      etag: 'version1',
      contentType: 'image/jpeg',
      downloadUrl: 'https://test.public.blob.vercel-storage.com/photo.jpg?download=1',
      contentDisposition: 'attachment',
    },
  },
}
function request(value: unknown, signed = true) {
  const text = JSON.stringify(value)
  return new Request('https://blikka.app/api/blob/upload', {
    method: 'POST',
    body: text,
    headers: signed
      ? { 'x-vercel-signature': createHmac('sha256', token).update(text).digest('hex') }
      : {},
  })
}
beforeEach(() => {
  vi.stubEnv('DEPLOYMENT_PROFILE', 'vercel-by-camera')
  vi.stubEnv('SUBMISSIONS_BUCKET_NAME', 'submissions')
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', token)
  send.mockReset().mockResolvedValue({ messageId: 'job' })
})
afterEach(() => vi.unstubAllEnvs())
describe('Blob completion endpoint', () => {
  it('verifies the original signed body and queues the exact key', async () => {
    expect((await POST(request(body))).status).toBe(200)
    expect(send).toHaveBeenCalledWith(
      'by-camera-uploads',
      { submissionKeys: [key] },
      { idempotencyKey: `blob:submissions/${key}:version1` },
    )
  })
  it('rejects an unsigned callback before publishing', async () => {
    await expect(POST(request(body, false))).rejects.toThrow('Missing callback signature')
    expect(send).not.toHaveBeenCalled()
  })
  it('does not mint tokens on the public callback endpoint', async () => {
    expect((await POST(request({ type: 'blob.generate-client-token', payload: {} }))).status).toBe(
      400,
    )
    expect(send).not.toHaveBeenCalled()
  })
  it('rejects a signed callback with a mismatched pathname', async () => {
    await expect(
      POST(
        request({
          ...body,
          payload: { ...body.payload, blob: { ...body.payload.blob, pathname: 'other/key' } },
        }),
      ),
    ).rejects.toThrow('Unexpected Blob upload identity')
    expect(send).not.toHaveBeenCalled()
  })
  it('propagates queue failures so Blob can retry completion delivery', async () => {
    send.mockRejectedValue(new Error('queue unavailable'))
    await expect(POST(request(body))).rejects.toThrow('queue unavailable')
  })
})
