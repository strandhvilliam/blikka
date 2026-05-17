import { assert, describe, layer } from '@effect/vitest'
import { Effect } from 'effect'
import { RULE_KEYS, VALIDATION_OUTCOME } from './constants'
import { ValidationEngine, ValidationEngineLayer } from './engine'
import { type ValidationInput, type ValidationRule } from './schemas'

function createMockInput(overrides?: Partial<ValidationInput>): ValidationInput {
  return {
    fileName: 'test_image.jpg',
    fileSize: 5000000,
    orderIndex: 0,
    mimeType: 'image/jpeg',
    exif: {
      Make: 'Sony',
      Model: 'ILCE-7M3',
      DateTimeOriginal: '2023-06-15T14:30:00Z',
      CreateDate: '2023-06-15T14:30:00Z',
      ModifyDate: '2023-06-15T14:30:00Z',
      Software: '',
      FNumber: 2.8,
      ExposureTime: '1/125',
      ISO: 400,
      LensModel: 'FE 24-70mm F2.8 GM',
      FocalLength: '50mm',
      Flash: 'Off',
      WhiteBalance: 'Auto',
      ColorSpace: 'sRGB',
      ExifImageWidth: 6000,
      ExifImageHeight: 4000,
      Compression: 'JPEG',
      Orientation: 1,
    },
    ...overrides,
  }
}

layer(ValidationEngineLayer)('ValidationEngine', (it) => {
  describe('executeRule - MAX_FILE_SIZE', () => {
    it.effect('should pass when file size is within limit', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MAX_FILE_SIZE,
          enabled: true,
          severity: 'error',
          params: { max_file_size: { maxBytes: 10000000 } },
        }

        const inputs = [createMockInput({ fileSize: 5000000 })]
        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
        assert.strictEqual(results[0]?.ruleKey, RULE_KEYS.MAX_FILE_SIZE)
      }),
    )

    it.effect('should fail when file size exceeds limit', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MAX_FILE_SIZE,
          enabled: true,
          severity: 'error',
          params: { max_file_size: { maxBytes: 5000000 } },
        }

        const inputs = [createMockInput({ fileSize: 10000000 })]
        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.strictEqual(results[0]?.ruleKey, RULE_KEYS.MAX_FILE_SIZE)
        assert.include(results[0]?.message, 'File size is too large')
      }),
    )

    it.effect('should validate multiple inputs', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MAX_FILE_SIZE,
          enabled: true,
          severity: 'error',
          params: { max_file_size: { maxBytes: 8000000 } },
        }

        const inputs = [
          createMockInput({ fileSize: 5000000, orderIndex: 0 }),
          createMockInput({ fileSize: 7000000, orderIndex: 1 }),
          createMockInput({ fileSize: 10000000, orderIndex: 2 }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 3)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
        assert.strictEqual(results[1]?.outcome, VALIDATION_OUTCOME.PASSED)
        assert.strictEqual(results[2]?.outcome, VALIDATION_OUTCOME.FAILED)
      }),
    )
  })

  describe('executeRule - ALLOWED_FILE_TYPES', () => {
    it.effect('should pass for allowed file types', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpg', 'jpeg', 'png'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo.jpg', mimeType: 'image/jpeg' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should treat jpg rule config as allowing jpeg files', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpg'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo.jpeg', mimeType: 'image/jpeg' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should treat jpeg rule config as allowing jpg files', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpeg'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo.jpg', mimeType: 'image/jpeg' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should deduplicate jpg and jpeg aliases during validation', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpg', 'jpeg'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo.jpeg', mimeType: 'image/jpeg' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should fail for disallowed file types', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpg', 'jpeg'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo.png', mimeType: 'image/png' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'Invalid file extension')
      }),
    )

    it.effect('should fail png files when only jpeg alias is configured', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpeg'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo.png', mimeType: 'image/png' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'Invalid file extension')
      }),
    )

    it.effect('should skip when file extension cannot be determined', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
          enabled: true,
          severity: 'error',
          params: {
            allowed_file_types: { allowedFileTypes: ['jpg', 'jpeg'] },
          },
        }

        const inputs = [createMockInput({ fileName: 'photo', mimeType: 'image/jpeg' })]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.SKIPPED)
      }),
    )
  })

  describe('executeRule - WITHIN_TIMERANGE', () => {
    it.effect('should pass when photo is within timerange', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
          enabled: true,
          severity: 'error',
          params: {
            within_timerange: {
              start: '2023-06-15T12:00:00Z',
              end: '2023-06-15T16:00:00Z',
            },
          },
        }

        const inputs = [
          createMockInput({
            exif: {
              DateTimeOriginal: '2023-06-15T14:30:00Z',
            },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should fail when photo is outside timerange', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
          enabled: true,
          severity: 'error',
          params: {
            within_timerange: {
              start: '2023-06-15T12:00:00Z',
              end: '2023-06-15T16:00:00Z',
            },
          },
        }

        const inputs = [
          createMockInput({
            exif: {
              DateTimeOriginal: '2023-06-15T18:00:00Z',
            },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'outside of the specified timeframe')
      }),
    )

    it.effect('should skip when timestamp cannot be determined', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
          enabled: true,
          severity: 'error',
          params: {
            within_timerange: {
              start: '2023-06-15T12:00:00Z',
              end: '2023-06-15T16:00:00Z',
            },
          },
        }

        const inputs = [
          createMockInput({
            exif: {},
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.SKIPPED)
      }),
    )
  })

  describe('executeRule - STRICT_TIMESTAMP_ORDERING', () => {
    it.effect('should pass when images are in correct chronological order', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
          enabled: true,
          severity: 'error',
          params: { strict_timestamp_ordering: {} },
        }

        const inputs = [
          createMockInput({
            orderIndex: 0,
            exif: { DateTimeOriginal: '2023-06-15T14:00:00Z' },
          }),
          createMockInput({
            orderIndex: 1,
            exif: { DateTimeOriginal: '2023-06-15T15:00:00Z' },
          }),
          createMockInput({
            orderIndex: 2,
            exif: { DateTimeOriginal: '2023-06-15T16:00:00Z' },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
        assert.strictEqual(results[0]?.isGeneral, true)
      }),
    )

    it.effect('should fail when images are out of chronological order', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
          enabled: true,
          severity: 'error',
          params: { strict_timestamp_ordering: {} },
        }

        const inputs = [
          createMockInput({
            orderIndex: 0,
            exif: { DateTimeOriginal: '2023-06-15T16:00:00Z' },
          }),
          createMockInput({
            orderIndex: 1,
            exif: { DateTimeOriginal: '2023-06-15T14:00:00Z' },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'does not match chronological timestamp order')
      }),
    )

    it.effect('should skip when not enough images', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
          enabled: true,
          severity: 'error',
          params: { strict_timestamp_ordering: {} },
        }

        const inputs = [createMockInput()]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.SKIPPED)
      }),
    )
  })

  describe('executeRule - SAME_DEVICE', () => {
    it.effect('should pass when all images are from same device', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.SAME_DEVICE,
          enabled: true,
          severity: 'warning',
          params: { same_device: {} },
        }

        const inputs = [
          createMockInput({
            exif: { Make: 'Sony', Model: 'ILCE-7M3' },
          }),
          createMockInput({
            exif: { Make: 'Sony', Model: 'ILCE-7M3' },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should fail when images are from different devices', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.SAME_DEVICE,
          enabled: true,
          severity: 'warning',
          params: { same_device: {} },
        }

        const inputs = [
          createMockInput({
            exif: { Make: 'Sony', Model: 'ILCE-7M3' },
          }),
          createMockInput({
            exif: { Make: 'Canon', Model: 'EOS R5' },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'Different devices detected')
      }),
    )

    it.effect('should skip when not enough images', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.SAME_DEVICE,
          enabled: true,
          severity: 'warning',
          params: { same_device: {} },
        }

        const inputs = [createMockInput()]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.SKIPPED)
      }),
    )
  })

  describe('executeRule - MODIFIED', () => {
    it.effect('should pass when photo is unmodified', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MODIFIED,
          enabled: true,
          severity: 'warning',
          params: { modified: {} },
        }

        const inputs = [createMockInput()]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should fail when editing software is detected', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MODIFIED,
          enabled: true,
          severity: 'warning',
          params: { modified: {} },
        }

        const inputs = [
          createMockInput({
            exif: { Software: 'Adobe Photoshop 2024' },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'editing software')
      }),
    )

    it.effect('should fail when timestamps show modification', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MODIFIED,
          enabled: true,
          severity: 'warning',
          params: { modified: {} },
        }

        const inputs = [
          createMockInput({
            exif: {
              DateTimeOriginal: '2023-06-15T14:00:00Z',
              CreateDate: '2023-06-15T14:00:00Z',
              ModifyDate: '2023-06-15T16:00:00Z',
            },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'timestamp inconsistencies')
      }),
    )

    it.effect('should fail when EXIF data is limited', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rule: ValidationRule = {
          ruleKey: RULE_KEYS.MODIFIED,
          enabled: true,
          severity: 'warning',
          params: { modified: {} },
        }

        const inputs = [
          createMockInput({
            exif: {
              Make: 'Sony',
              Model: 'ILCE-7M3',
            },
          }),
        ]

        const results = yield* engine.runValidations([rule], inputs)

        assert.lengthOf(results, 1)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.include(results[0]?.message, 'Limited EXIF data')
      }),
    )
  })

  describe('runValidations - multiple rules', () => {
    it.effect('should execute multiple rules and return all results', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rules: ValidationRule[] = [
          {
            ruleKey: RULE_KEYS.MAX_FILE_SIZE,
            enabled: true,
            severity: 'error',
            params: { max_file_size: { maxBytes: 10000000 } },
          },
          {
            ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
            enabled: true,
            severity: 'error',
            params: {
              allowed_file_types: { allowedFileTypes: ['jpg', 'jpeg'] },
            },
          },
        ]

        const inputs = [
          createMockInput({
            fileName: 'photo.jpg',
            fileSize: 5000000,
            mimeType: 'image/jpeg',
          }),
        ]

        const results = yield* engine.runValidations(rules, inputs)

        assert.lengthOf(results, 2)
        assert.strictEqual(results[0]?.ruleKey, RULE_KEYS.MAX_FILE_SIZE)
        assert.strictEqual(results[1]?.ruleKey, RULE_KEYS.ALLOWED_FILE_TYPES)
      }),
    )

    it.effect('should handle mix of passing and failing validations', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rules: ValidationRule[] = [
          {
            ruleKey: RULE_KEYS.MAX_FILE_SIZE,
            enabled: true,
            severity: 'error',
            params: { max_file_size: { maxBytes: 4000000 } },
          },
          {
            ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
            enabled: true,
            severity: 'error',
            params: {
              allowed_file_types: { allowedFileTypes: ['jpg', 'jpeg'] },
            },
          },
        ]

        const inputs = [
          createMockInput({
            fileName: 'photo.jpg',
            fileSize: 5000000,
            mimeType: 'image/jpeg',
          }),
        ]

        const results = yield* engine.runValidations(rules, inputs)

        assert.lengthOf(results, 2)
        assert.strictEqual(results[0]?.outcome, VALIDATION_OUTCOME.FAILED)
        assert.strictEqual(results[1]?.outcome, VALIDATION_OUTCOME.PASSED)
      }),
    )

    it.effect('should flatten per-input and cross-input validation results', () =>
      Effect.gen(function* () {
        const engine = yield* ValidationEngine

        const rules: ValidationRule[] = [
          {
            ruleKey: RULE_KEYS.MAX_FILE_SIZE,
            enabled: true,
            severity: 'error',
            params: { max_file_size: { maxBytes: 10000000 } },
          },
          {
            ruleKey: RULE_KEYS.SAME_DEVICE,
            enabled: true,
            severity: 'warning',
            params: { same_device: {} },
          },
        ]

        const inputs = [createMockInput({ orderIndex: 0 }), createMockInput({ orderIndex: 1 })]

        const results = yield* engine.runValidations(rules, inputs)

        assert.lengthOf(results, 3)
        assert.lengthOf(
          results.filter((r) => r.ruleKey === RULE_KEYS.MAX_FILE_SIZE),
          2,
        )
        assert.lengthOf(
          results.filter((r) => r.ruleKey === RULE_KEYS.SAME_DEVICE),
          1,
        )
      }),
    )
  })
})
