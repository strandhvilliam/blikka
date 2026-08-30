'use client'

/**
 * Writes a jury result-images manifest straight to a folder the organizer picks, using the File System
 * Access API. There is no ZIP: the manifest lists every folder path, a same-origin URL per image, and
 * the text files (README, CSV, per-juror markers) inline, and this recreates that tree on disk. One
 * missing photo is recorded and skipped rather than failing the whole download.
 *
 * Chromium only (`showDirectoryPicker`). Callers gate on {@link supportsDirectoryPicker} first.
 */

export interface JuryImageManifest {
  rootFolder: string
  files: Array<{ path: string; url: string }>
  textFiles: Array<{ path: string; content: string }>
  entryCount: number
  distinctObjectCount: number
}

export interface JuryImageWriteProgress {
  completed: number
  total: number
  currentPath: string
}

export interface JuryImageWriteResult {
  rootFolder: string
  written: number
  failed: Array<{ path: string; reason: string }>
}

// Minimal shapes for the parts of the File System Access API we touch, so this compiles regardless of
// whether the DOM lib in use ships the full typings.
interface WritableFileStreamLike {
  write(data: Blob | string): Promise<void>
  close(): Promise<void>
}
interface FileHandleLike {
  createWritable(): Promise<WritableFileStreamLike>
}
interface DirectoryHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
}
interface DirectoryPickerWindow {
  showDirectoryPicker(options?: {
    mode?: 'read' | 'readwrite'
    id?: string
  }): Promise<DirectoryHandleLike>
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function writeJuryImagesToDirectory(
  manifestUrl: string,
  callbacks: {
    onProgress?: (progress: JuryImageWriteProgress) => void
    signal?: AbortSignal
  } = {},
): Promise<JuryImageWriteResult> {
  const { onProgress, signal } = callbacks

  // Ask for the folder first: a dismissed picker throws AbortError before any manifest fetch, so a
  // cancel costs nothing.
  const rootHandle = await (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
    mode: 'readwrite',
    id: 'jury-result-images',
  })

  const response = await fetch(manifestUrl, { signal })
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response))
  }
  const manifest = (await response.json()) as JuryImageManifest

  const total = manifest.textFiles.length + manifest.files.length
  const failed: JuryImageWriteResult['failed'] = []
  const directoryCache = new Map<string, DirectoryHandleLike>()
  let completed = 0

  const emit = (currentPath: string) => onProgress?.({ completed, total, currentPath })

  // Text files first — small, and they give the folder its shape before the photos start landing.
  for (const textFile of manifest.textFiles) {
    throwIfAborted(signal)
    emit(textFile.path)
    try {
      const handle = await resolveFileHandle(rootHandle, textFile.path, directoryCache)
      await writeToHandle(handle, textFile.content)
    } catch (error) {
      failed.push({ path: textFile.path, reason: describeError(error) })
    }
    completed += 1
    emit(textFile.path)
  }

  for (const file of manifest.files) {
    throwIfAborted(signal)
    emit(file.path)
    try {
      const imageResponse = await fetch(file.url, { signal })
      if (!imageResponse.ok) {
        throw new Error(`HTTP ${imageResponse.status}`)
      }
      const blob = await imageResponse.blob()
      const handle = await resolveFileHandle(rootHandle, file.path, directoryCache)
      await writeToHandle(handle, blob)
    } catch (error) {
      if (isAbortError(error)) throw error
      failed.push({ path: file.path, reason: describeError(error) })
    }
    completed += 1
    emit(file.path)
  }

  return { rootFolder: manifest.rootFolder, written: completed - failed.length, failed }
}

/** Walks (creating as needed) the directory segments of a manifest path and returns the file handle. */
async function resolveFileHandle(
  root: DirectoryHandleLike,
  path: string,
  cache: Map<string, DirectoryHandleLike>,
): Promise<FileHandleLike> {
  const segments = path.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) {
    throw new Error(`Invalid path: ${path}`)
  }

  let directory = root
  let accumulated = ''
  for (const segment of segments) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment
    const cached = cache.get(accumulated)
    if (cached) {
      directory = cached
      continue
    }
    directory = await directory.getDirectoryHandle(segment, { create: true })
    cache.set(accumulated, directory)
  }

  return directory.getFileHandle(fileName, { create: true })
}

async function writeToHandle(handle: FileHandleLike, data: Blob | string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; details?: string }
    return body.details ?? body.error ?? `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}
