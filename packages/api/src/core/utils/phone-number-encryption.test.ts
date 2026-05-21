import { describe, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { expect } from 'vitest'

import { configLayerFromEnv } from '../test/config-layer'
import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionError,
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
} from './phone-number-encryption'

const testConfigLayer = configLayerFromEnv({
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  HMAC_KEY: 'test-hmac-key',
})

const testLayer = PhoneNumberEncryptionServiceLayer.pipe(Layer.provide(testConfigLayer))

describe('PhoneNumberEncryptionService', () => {
  it.effect('encrypts, decrypts, and hashes phone numbers consistently', () =>
    Effect.gen(function* () {
      const service = yield* PhoneNumberEncryptionService
      const phoneNumber = '+4712345678'

      const encrypted = yield* service.encrypt({ phoneNumber })
      const decrypted = yield* service.decrypt({ encrypted: encrypted.encrypted })
      const hash = yield* service.hashLookup({ phoneNumber })

      expect(decrypted).toBe(phoneNumber)
      expect(hash).toBe(encrypted.hash)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('fails for invalid phone numbers', () =>
    Effect.gen(function* () {
      const service = yield* PhoneNumberEncryptionService
      const result = yield* Effect.flip(service.encrypt({ phoneNumber: 'not-a-phone' }))

      expect(result).toBeInstanceOf(PhoneNumberEncryptionError)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('fails when decrypting a tampered blob', () =>
    Effect.gen(function* () {
      const service = yield* PhoneNumberEncryptionService
      const { encrypted } = yield* service.encrypt({ phoneNumber: '+4712345678' })
      const tampered = EncryptedPhoneNumber(`${encrypted}x`)
      const result = yield* Effect.flip(service.decrypt({ encrypted: tampered }))

      expect(result).toBeInstanceOf(PhoneNumberEncryptionError)
    }).pipe(Effect.provide(testLayer)),
  )
})
