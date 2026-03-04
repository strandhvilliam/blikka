import exifr from "exifr"
import { Effect, Schema, ServiceMap } from "effect"
import { ExifSchema } from "./schemas"
import { removeGpsData, sanitizeExifData } from "./utils"

export class ExifParseError extends Schema.TaggedErrorClass<ExifParseError>()("ExifParserError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class ExifParser extends ServiceMap.Service<ExifParser>()(
  "@blikka/exif-parser/exif-parser",
  {
    make: Effect.gen(function* () {
      const parse = Effect.fn("ExifParser.parse")(
        function* (
          file: Buffer,
          options: { keepBinaryData: boolean } = { keepBinaryData: false }
        ) {
          const exif = yield* Effect.tryPromise(() => exifr.parse(file))
          const sanitizedExif = yield* Effect.try({
            try: () =>
              sanitizeExifData(exif, options?.keepBinaryData),
            catch: (error) => new ExifParseError({ cause: error, message: "Failed to sanitize EXIF data" }),
          })
          const decoded = yield* Schema.decodeUnknownEffect(ExifSchema)(sanitizedExif)
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
}
