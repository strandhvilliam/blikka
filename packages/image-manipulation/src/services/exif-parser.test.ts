import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { ExifParser, ExifParserLayer } from './exif-parser'

/** 8x8 JPEG written without any metadata — exifr resolves `undefined` for these. */
const JPEG_WITHOUT_EXIF = Buffer.from(
  '/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCIBQDf/9k=',
  'base64',
)

/** The same image carrying an EXIF block with Orientation set. */
const JPEG_WITH_EXIF = Buffer.from(
  '/9j/4QC8RXhpZgAASUkqAAgAAAAGABIBAwABAAAABgAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAZgAAAAAAAAA4YwAA6AMAADhjAADoAwAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQAAAP//AAACoAQAAQAAAAgAAAADoAQAAQAAAAgAAAAAAAAA/+IB8ElDQ19QUk9GSUxFAAEBAAAB4GxjbXMEIAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5keem/Vlo+AbaDI4VVRvdPqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAkY3BydAAAASAAAAAid3RwdAAAAUQAAAAUY2hhZAAAAVgAAAAsclhZWgAAAYQAAAAUZ1hZWgAAAZgAAAAUYlhZWgAAAawAAAAUclRSQwAAAcAAAAAgZ1RSQwAAAcAAAAAgYlRSQwAAAcAAAAAgbWx1YwAAAAAAAAABAAAADGVuVVMAAAAIAAAAHABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAGAAAAHABDAEMAMAAAWFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDD8AAAXd///zJgAAB5AAAP2S///7of///aIAAAPcAADAcVhZWiAAAAAAAABvoAAAOPIAAAOPWFlaIAAAAAAAAGKWAAC3iQAAGNpYWVogAAAAAAAAJKAAAA+FAAC2xHBhcmEAAAAAAAMAAAACZmkAAPKnAAANWQAAE9AAAApb/9sAQwAUDg8SDw0UEhASFxUUGB4yIR4cHB49LC4kMklATEtHQEZFUFpzYlBVbVZFRmSIZW13e4GCgU5gjZeMfZZzfoF8/9sAQwEVFxceGh47ISE7fFNGU3x8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8/8AAEQgACAAIAwEiAAIRAQMRAf/EABUAAQEAAAAAAAAAAAAAAAAAAAAE/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABUBAQEAAAAAAAAAAAAAAAAAAAQF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AiAUA3//Z',
  'base64',
)

describe('ExifParser.parse', () => {
  it.effect('returns an empty record for a photo carrying no EXIF', () =>
    Effect.gen(function* () {
      const parser = yield* ExifParser
      const exif = yield* parser.parse(JPEG_WITHOUT_EXIF)

      assert.deepStrictEqual(exif, {})
    }).pipe(Effect.provide(ExifParserLayer)),
  )

  it.effect('reads EXIF fields when the photo carries them', () =>
    Effect.gen(function* () {
      const parser = yield* ExifParser
      const exif = yield* parser.parse(JPEG_WITH_EXIF)

      assert.strictEqual(exif.Orientation, 'Rotate 90 CW')
    }).pipe(Effect.provide(ExifParserLayer)),
  )

  it.effect('fails with a recoverable ExifParseError rather than a defect', () =>
    Effect.gen(function* () {
      const parser = yield* ExifParser

      // `Effect.catch` only sees typed failures; a defect here would escape it and surface as
      // a 500 on the admin regenerate path instead of degrading to no EXIF.
      const recovered = yield* parser
        .parse(Buffer.from('not an image'))
        .pipe(Effect.catch(() => Effect.succeed({ recovered: true })))

      assert.deepStrictEqual(recovered, { recovered: true })
    }).pipe(Effect.provide(ExifParserLayer)),
  )
})
