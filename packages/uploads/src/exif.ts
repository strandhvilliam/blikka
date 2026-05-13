import type { ExifState } from "@blikka/kv-store";

export function hasExifFields(
  exif: ExifState | null | undefined,
): exif is ExifState {
  return exif !== null && exif !== undefined && Object.keys(exif).length > 0;
}

export function mergeExifStates(
  preferredExif: ExifState,
  parsedExif: ExifState,
): ExifState {
  return {
    ...parsedExif,
    ...preferredExif,
  };
}
