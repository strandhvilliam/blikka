import { afterEach, describe, expect, it, vi } from 'vitest'

async function importFileProcessing() {
  vi.doMock('./exif-parsing', () => ({
    getExifDate: (exif?: Record<string, unknown> | null) => {
      if (!exif) return null
      const dateValue = exif.DateTimeOriginal || exif.CreateDate
      if (typeof dateValue !== 'string') {
        return null
      }

      const date = new Date(dateValue)
      return Number.isNaN(date.getTime()) ? null : date
    },
    parseExifData: vi.fn().mockResolvedValue(null),
  }))

  return await import('./file-processing')
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.doUnmock('./exif-parsing')
})

describe('file-processing', () => {
  it('detects HEIC files by mime type and extension', async () => {
    const { isHeicFile } = await importFileProcessing()

    expect(isHeicFile(new File(['heic'], 'capture.heic', { type: 'image/heic' }))).toBe(true)
    expect(isHeicFile(new File(['heif'], 'capture.heif', { type: '' }))).toBe(true)
    expect(isHeicFile(new File(['jpg'], 'capture.jpg', { type: 'image/jpeg' }))).toBe(false)
  })

  it('filters unsupported files during normalization', async () => {
    const { normalizeSelectedImageFiles } = await importFileProcessing()

    const result = await normalizeSelectedImageFiles([
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
    ])

    expect(result.candidates).toEqual([])
    expect(result.warnings).toEqual(['notes.txt: unsupported file type'])
  })

  it('resolves selected image content types from mime type or file extension', async () => {
    const { resolveSelectedImageContentType } = await importFileProcessing()

    expect(
      resolveSelectedImageContentType({
        type: 'image/png',
        name: 'capture.png',
      }),
    ).toBe('image/png')

    expect(
      resolveSelectedImageContentType({
        type: 'image/jpg',
        name: 'capture.jpg',
      }),
    ).toBe('image/jpeg')

    expect(
      resolveSelectedImageContentType({
        type: '',
        name: 'capture.webp',
      }),
    ).toBe('image/webp')

    expect(
      resolveSelectedImageContentType({
        type: '',
        name: 'capture',
      }),
    ).toBeNull()
  })

  it('skips duplicates case-insensitively', async () => {
    const { filterDuplicateImageCandidates } = await importFileProcessing()

    const { uniqueCandidates, duplicateFileNames } = filterDuplicateImageCandidates(
      [
        { file: new File(['one'], 'A.JPG'), preconvertedExif: null },
        { file: new File(['two'], 'a.jpg'), preconvertedExif: null },
        { file: new File(['three'], 'b.jpg'), preconvertedExif: null },
      ],
      ['existing.jpg'],
    )

    expect(uniqueCandidates.map((candidate) => candidate.file.name)).toEqual(['A.JPG', 'b.jpg'])
    expect(duplicateFileNames).toEqual(['a.jpg'])
  })

  it('truncates candidates deterministically to the max count', async () => {
    const { limitImageCandidates } = await importFileProcessing()

    const { acceptedCandidates, truncatedCount } = limitImageCandidates(
      ['first', 'second', 'third'],
      2,
    )

    expect(acceptedCandidates).toEqual(['first', 'second'])
    expect(truncatedCount).toBe(1)
  })

  it('sorts items by EXIF date', async () => {
    const { sortByExifDate } = await importFileProcessing()

    const sorted = sortByExifDate(
      [
        { id: 'late', exif: { DateTimeOriginal: '2024-03-01T10:00:00.000Z' } },
        { id: 'none', exif: {} },
        { id: 'early', exif: { CreateDate: '2024-03-01T08:00:00.000Z' } },
      ],
      (item) => item.exif,
    )

    expect(sorted.map((item) => item.id)).toEqual(['early', 'late', 'none'])
  })

  it('reassigns order indexes using topic order indexes first', async () => {
    const { reassignOrderIndexes } = await importFileProcessing()

    const reordered = reassignOrderIndexes(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [4, 8],
      (item, orderIndex) => ({
        ...item,
        orderIndex,
      }),
    )

    expect(reordered).toEqual([
      { id: 'a', orderIndex: 4 },
      { id: 'b', orderIndex: 8 },
      { id: 'c', orderIndex: 2 },
    ])
  })

  it('revokes preview urls for each item', async () => {
    const { revokePreviewUrls } = await importFileProcessing()
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    revokePreviewUrls(
      [{ previewUrl: 'blob:one' }, { previewUrl: 'blob:two' }],
      (item) => item.previewUrl,
    )

    expect(revokeSpy).toHaveBeenCalledTimes(2)
    expect(revokeSpy).toHaveBeenNthCalledWith(1, 'blob:one')
    expect(revokeSpy).toHaveBeenNthCalledWith(2, 'blob:two')
  })

  it('generates thumbnail object urls from a resized image blob', async () => {
    const closeSpy = vi.fn()
    const drawImageSpy = vi.fn()
    const convertToBlobSpy = vi.fn().mockResolvedValue(new Blob(['thumb'], { type: 'image/jpeg' }))
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 320,
        height: 180,
        close: closeSpy,
      }),
    )
    vi.stubGlobal(
      'OffscreenCanvas',
      class FakeOffscreenCanvas {
        width: number
        height: number

        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }

        getContext() {
          return {
            drawImage: drawImageSpy,
          }
        }

        convertToBlob = convertToBlobSpy
      },
    )

    const { generateClientPreview } = await importFileProcessing()
    const file = new File(['original'], 'capture.jpg', { type: 'image/jpeg' })

    const preview = await generateClientPreview(file)

    expect(preview).toEqual({ status: 'ready', url: 'blob:thumb' })
    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      resizeWidth: 400,
      resizeQuality: 'medium',
      imageOrientation: 'from-image',
    })
    expect(drawImageSpy).toHaveBeenCalledTimes(1)
    expect(convertToBlobSpy).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.7,
    })
    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob))
    expect(createObjectURLSpy).not.toHaveBeenCalledWith(file)
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  function stubCanvasElement(canvas: Record<string, unknown>) {
    const createElement = vi.fn(() => canvas)
    vi.stubGlobal('document', { createElement })
    return createElement
  }

  it('falls back to an element canvas when OffscreenCanvas is unavailable', async () => {
    const closeSpy = vi.fn()
    const drawImageSpy = vi.fn()
    const toBlobSpy = vi.fn(
      (callback: (blob: Blob | null) => void, type?: string, quality?: number) => {
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.7)
        callback(new Blob(['thumb'], { type: 'image/jpeg' }))
      },
    )
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 320, height: 180, close: closeSpy }),
    )
    vi.stubGlobal('OffscreenCanvas', undefined)

    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: drawImageSpy }),
      toBlob: toBlobSpy,
    }
    const createElementSpy = stubCanvasElement(canvas)

    const { generateClientPreview } = await importFileProcessing()
    const preview = await generateClientPreview(new File(['original'], 'capture.jpg'))

    expect(preview).toEqual({ status: 'ready', url: 'blob:thumb' })
    expect(createElementSpy).toHaveBeenCalledWith('canvas')
    expect(canvas.width).toBe(320)
    expect(canvas.height).toBe(180)
    expect(drawImageSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('falls back to an element canvas when the offscreen 2d context is missing', async () => {
    const drawImageSpy = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 320, height: 180, close: vi.fn() }),
    )
    vi.stubGlobal(
      'OffscreenCanvas',
      class FakeOffscreenCanvas {
        getContext() {
          return null
        }
      },
    )
    stubCanvasElement({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: drawImageSpy }),
      toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['thumb'])),
    })

    const { generateClientPreview } = await importFileProcessing()
    const preview = await generateClientPreview(new File(['original'], 'capture.jpg'))

    expect(preview).toEqual({ status: 'ready', url: 'blob:thumb' })
    expect(drawImageSpy).toHaveBeenCalledTimes(1)
  })

  it('returns unavailable when the element canvas cannot encode', async () => {
    const closeSpy = vi.fn()
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback')
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 320, height: 180, close: closeSpy }),
    )
    vi.stubGlobal('OffscreenCanvas', undefined)
    stubCanvasElement({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: (blob: Blob | null) => void) => callback(null),
    })

    const { generateClientPreview } = await importFileProcessing()
    const preview = await generateClientPreview(new File(['original'], 'capture.jpg'))

    expect(preview).toEqual({ status: 'unavailable' })
    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('skips preview for large files without treating it as a failure', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback')
    const createImageBitmapSpy = vi.fn()
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy)

    const { CLIENT_PREVIEW_MAX_FILE_BYTES, generateClientPreview } = await importFileProcessing()
    const file = new File([new Uint8Array(CLIENT_PREVIEW_MAX_FILE_BYTES)], 'pro.jpg', {
      type: 'image/jpeg',
    })

    const preview = await generateClientPreview(file)

    expect(preview).toEqual({ status: 'skipped-large', reason: 'large-file' })
    expect(createImageBitmapSpy).not.toHaveBeenCalled()
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('returns unavailable when thumbnail generation fails without full-file object urls', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback')

    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))

    const { generateClientPreview } = await importFileProcessing()
    const file = new File(['original'], 'capture.jpg', { type: 'image/jpeg' })

    const preview = await generateClientPreview(file)

    expect(preview).toEqual({ status: 'unavailable' })
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })
})
