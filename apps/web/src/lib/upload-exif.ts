export interface UploadExifCandidate {
  preconvertedExif?: Record<string, unknown> | null;
}

export function buildUploadExifPayload(
  photos: readonly UploadExifCandidate[],
): Array<Record<string, unknown> | null> | undefined {
  const payload = photos.map((photo) => {
    const exif = photo.preconvertedExif;
    if (!exif || Object.keys(exif).length === 0) {
      return null;
    }

    return exif;
  });

  return payload.some((entry) => entry !== null) ? payload : undefined;
}
