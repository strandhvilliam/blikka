import { Effect } from "effect";
import { ExifParser } from "@blikka/image-manipulation/exif-parser";
import { clientRuntime } from "./client-runtime";

export type ExifData = Record<string, unknown>;

export async function parseExifData(file: File): Promise<ExifData | null> {
  try {
    const buffer = await file.arrayBuffer();
    const tags = await clientRuntime.runPromise(
      Effect.gen(function* () {
        const parser = yield* ExifParser;
        return yield* parser.parse(new Uint8Array(buffer));
      }),
    );

    return tags as ExifData;
  } catch {
    return null;
  }
}

export function getExifDate(exif?: ExifData | null): Date | null {
  if (!exif) {
    return null;
  }

  const dateValue = exif.DateTimeOriginal || exif.CreateDate;
  if (typeof dateValue !== "string") {
    return null;
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}
