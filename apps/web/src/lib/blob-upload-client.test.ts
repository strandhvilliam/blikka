import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadFileToPresignedUrl } from './upload-client'
const { put } = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({ put }))
afterEach(() => {
  put.mockReset()
  vi.unstubAllGlobals()
})
const descriptor = `blob-upload:${encodeURIComponent(JSON.stringify({ pathname: 'submissions/demo/A/01/photo.jpg', token: 'scoped-token' }))}`
describe('direct Blob upload', () => {
  it('uploads multipart with the scoped token, without posting image bytes through the app', async () => {
    put.mockResolvedValue({})
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
    expect(await uploadFileToPresignedUrl({ file, presignedUrl: descriptor })).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      'submissions/demo/A/01/photo.jpg',
      file,
      expect.objectContaining({
        token: 'scoped-token',
        access: 'public',
        multipart: true,
        contentType: 'image/jpeg',
      }),
    )
    expect(fetch).not.toHaveBeenCalled()
  })
  it('asks the existing recovery flow to refresh expired Blob tokens', async () => {
    put.mockRejectedValue(new Error('Vercel Blob: Client token has expired.'))
    const result = await uploadFileToPresignedUrl({
      file: new File(['image'], 'photo.jpg'),
      presignedUrl: descriptor,
    })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'UPLOAD_URL_EXPIRED', retryMode: 'refresh-url' },
    })
  })
})
