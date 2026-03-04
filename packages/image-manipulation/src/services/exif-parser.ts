import exifr from "exifr"
import { ServiceMap, Effect, Schema, Layer } from "effect"
import { SharpImageService } from "./sharp-image-service"

export class ExifParseError extends Schema.TaggedErrorClass<ExifParseError>()("ExifParserError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {
}

export const ExifSchema = Schema.Record(
  Schema.String,
  Schema.Unknown,
)

export type ExifData = typeof ExifSchema.Type

export class ExifParser extends ServiceMap.Service<ExifParser>()(
  "@blikka/exif-parser/exif-parser",
  {
    make: Effect.gen(function* () {
      const parse = Effect.fn("ExifParser.parse")(
        function* (
          file: Uint8Array<ArrayBufferLike>,
          options: { keepBinaryData: boolean } = { keepBinaryData: false }
        ) {
          const exif = yield* Effect.tryPromise(() => exifr.parse(file))
          const sanitizedExif = yield* Effect.try({
            try: () => sanitizeExifData(exif, options?.keepBinaryData),
            catch: (error) => new ExifParseError({ message: 'Failed to sanitize EXIF data', cause: error })
          })

          const decoded = Schema.decodeUnknownSync(ExifSchema)(sanitizedExif)
          return decoded
        },
        Effect.mapError(
          (error) =>
            new ExifParseError({
              cause: error,
              message: "Failed to parse EXIF data",
            })
        )
      )
      const parseExcludeLocationData = Effect.fn(
        "ExifParser.parseExcludeLocationData"
      )(function* (file: Buffer) {
        const exif = yield* parse(file)
        const withoutLocationData = yield* removeGpsData(exif)
        return withoutLocationData
      })

      return {
        parse,
        parseExcludeLocationData,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}


/**
 * Sanitizes EXIF data for safe serialization and storage.
 *
 * - Removes binary buffers (replaces with a marker string)
 * - Strips control characters from strings
 * - Converts Dates to ISO strings
 * - Recursively traverses arrays/objects
 * - Detects and handles circular references
 */
export const sanitizeExifData = (
  input: unknown,
  keepBinaryData: boolean = false,
  visited: WeakSet<object> = new WeakSet()
): unknown => {
  // simple primitives
  if (
    input === null ||
    input === undefined ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input
  }

  // Circular reference check
  if (typeof input === "object" && input !== null) {
    if (visited.has(input)) {
      return "[Circular Reference]"
    }
    visited.add(input)
  }

  // Binary data sanitization

  if (
    !keepBinaryData &&
    (input instanceof Uint8Array ||
      input instanceof ArrayBuffer ||
      Buffer.isBuffer(input))
  ) {
    const bytes =
      input instanceof ArrayBuffer
        ? input.byteLength
        : "byteLength" in input
          ? (input as { byteLength: number }).byteLength
          : 0
    return `[Binary Data: ${bytes} bytes]`
  }



  // Date → ISO
  if (input instanceof Date) {
    return input.toISOString()
  }

  // String sanitization
  if (typeof input === "string") {
    return input.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
  }

  // Arrays
  if (Array.isArray(input)) {
    const result = input.map((item) =>
      sanitizeExifData(item, keepBinaryData, visited)
    )
    visited.delete(input)
    return result
  }

  // Plain objects
  if (typeof input === "object" && input !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey =
        typeof key === "string"
          ? key.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
          : key
      if (sanitizedKey) {
        result[sanitizedKey] = sanitizeExifData(value, keepBinaryData, visited)
      }
    }
    visited.delete(input)
    return result
  }

  return input
}

/**
 * Removes GPS / location-related data from an EXIF object.
 */
export const removeGpsData = (exif: ExifData) =>
  Effect.sync(() => {
    const gpsKeys = new Set([
      "GPSLatitude",
      "GPSLongitude",
      "GPSAltitude",
      "GPSLatitudeRef",
      "GPSLongitudeRef",
      "GPSPosition",
      "GPSAltitudeRef",
      "GPSSpeed",
      "GPSSpeedRef",
      "GPSTimeStamp",
      "GPSSatellites",
      "GPSStatus",
      "GPSMeasureMode",
      "GPSMapDatum",
      "GPSDateStamp",
      "GPSProcessingMethod",
      "GPSAreaInformation",
      // some makers use more generic names
      "Location",
      "Latitude",
      "Longitude",
      "Altitude",
    ])

    const result = { ...exif }

    for (const key of Object.keys(exif)) {
      if (gpsKeys.has(key)) {
        delete result[key as keyof ExifData]
      }
    }

    return result
  })
