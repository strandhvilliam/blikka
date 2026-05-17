import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { RULE_KEYS } from './constants'
import { ValidationFailure, type ValidationInput } from './schemas'
import {
  validateAllowedFileTypes,
  validateMaxFileSize,
  validateSameDevice,
  validateStrictTimestampOrdering,
} from './validators'

const createMockInput = (overrides?: Partial<ValidationInput>): ValidationInput => ({
  fileName: 'test_image.jpg',
  fileSize: 5_000_000,
  orderIndex: 0,
  mimeType: 'image/jpeg',
  exif: {
    Make: 'Sony',
    Model: 'ILCE-7M3',
    DateTimeOriginal: '2023-06-15T14:30:00Z',
  },
  ...overrides,
})

describe('validators', () => {
  it.effect('exports individual validators that can be tested directly', () =>
    Effect.gen(function* () {
      yield* validateMaxFileSize({ maxBytes: 10_000_000 }, createMockInput())

      const sameDeviceResult = yield* validateSameDevice({}, [
        createMockInput({ exif: { Make: 'Sony', Model: 'ILCE-7M3' } }),
        createMockInput({ exif: { Make: 'Sony', Model: 'ILCE-7M3' } }),
      ])

      assert.isUndefined(sameDeviceResult)
    }),
  )

  it.effect('keeps multi-input validator failures testable without layers', () =>
    Effect.gen(function* () {
      const failure = yield* validateStrictTimestampOrdering({}, [
        createMockInput({
          orderIndex: 0,
          exif: { DateTimeOriginal: '2023-06-15T16:00:00Z' },
        }),
        createMockInput({
          orderIndex: 1,
          exif: { DateTimeOriginal: '2023-06-15T14:00:00Z' },
        }),
      ]).pipe(Effect.flip)

      assert.strictEqual(failure.ruleKey, RULE_KEYS.STRICT_TIMESTAMP_ORDERING)
    }),
  )

  it.effect('canonicalizes jpeg file extensions to jpg for allowed type checks', () =>
    Effect.gen(function* () {
      yield* validateAllowedFileTypes(
        { allowedFileTypes: ['jpg'] },
        createMockInput({ fileName: 'photo.jpeg', mimeType: 'image/jpeg' }),
      )

      yield* validateAllowedFileTypes(
        { allowedFileTypes: ['jpeg'] },
        createMockInput({ fileName: 'photo.jpg', mimeType: 'image/jpeg' }),
      )
    }),
  )

  it.effect('deduplicates jpg and jpeg aliases in failure context', () =>
    Effect.gen(function* () {
      const failure = yield* validateAllowedFileTypes(
        { allowedFileTypes: ['jpg', 'jpeg', 'png'] },
        createMockInput({ fileName: 'photo.webp', mimeType: 'image/webp' }),
      ).pipe(Effect.flip)

      assert.strictEqual(failure.ruleKey, RULE_KEYS.ALLOWED_FILE_TYPES)
      assert.deepStrictEqual((failure as ValidationFailure).context?.allowedExtensions, [
        'jpg',
        'png',
      ])
    }),
  )
})
