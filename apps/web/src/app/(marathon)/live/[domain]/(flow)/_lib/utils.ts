import { Effect } from "effect"
import { ExifParser } from "@blikka/image-manipulation/exif-parser"
import { clientRuntime } from "@/lib/client-runtime"

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export async function parseExifData(file: File): Promise<Record<string, unknown> | null> {
  try {
    const buff = await file.arrayBuffer()
    const tags = await clientRuntime.runPromise(
      Effect.gen(function* () {
        const parser = yield* ExifParser
        return yield* parser.parse(new Uint8Array(buff))
      }),
    )
    return tags as Record<string, unknown>
  } catch {
    return null
  }
}

export function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  )
}

export async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = await import("heic2any")
    const result = await heic2any.default({
      blob: file,
      toType: "image/jpeg",
      quality: 1,
    })
    const blob = Array.isArray(result) ? result[0] : result
    if (!blob) return null

    return new File([blob], file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"), {
      type: "image/jpeg",
    })
  } catch (error) {
    console.error(`Failed to convert HEIC file ${file.name}:`, error)
    return null
  }
}

export function getExifDate(exif: Record<string, unknown>): Date | null {
  if (!exif) return null
  const dateValue = exif.DateTimeOriginal || exif.CreateDate
  if (!dateValue) return null
  try {
    const date = new Date(dateValue as string)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}
