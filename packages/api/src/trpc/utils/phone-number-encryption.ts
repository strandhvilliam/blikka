import { Brand, Config, Effect, Layer, Schema, ServiceMap } from "effect"
import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto"

import { parsePhoneNumberWithError } from "libphonenumber-js"

export class PhoneNumberEncryptionError extends Schema.TaggedErrorClass<PhoneNumberEncryptionError>()(
  "@blikka/api/PhoneNumberEncryptionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export type EncryptedPhoneNumber = string & Brand.Brand<"EncryptedPhoneNumber">
export const EncryptedPhoneNumber = Brand.nominal<EncryptedPhoneNumber>()

export type PhoneHash = string & Brand.Brand<"PhoneHash">
export const PhoneHash = Brand.nominal<PhoneHash>()

export class PhoneNumberEncryptionService extends ServiceMap.Service<PhoneNumberEncryptionService>()(
  "@blikka/api/PhoneNumberEncryptionService",
  {
    make: Effect.gen(function* () {
      const rawEncryptionKey = yield* Config.string("ENCRYPTION_KEY")
      const encryptionKey = Buffer.from(rawEncryptionKey, "hex")
      const hmacKey = yield* Config.string("HMAC_KEY")

      const encrypt = Effect.fn("PhoneNumberEncryptionService.encrypt")(
        function* ({ phoneNumber }: { phoneNumber: string }) {
          const parsed = yield* Effect.try({
            try: () => parsePhoneNumberWithError(phoneNumber),
            catch: (error) =>
              new PhoneNumberEncryptionError({
                message: "Failed to parse phone number",
                cause: error,
              }),
          })
          const e164 = parsed.format("E.164")

          const hash = PhoneHash(createHmac("sha256", hmacKey).update(e164).digest("base64url"))

          const version = Buffer.from([1])
          const nonce = yield* Effect.try({
            try: () => randomBytes(12),
            catch: (error) =>
              new PhoneNumberEncryptionError({ message: "Failed to generate nonce", cause: error }),
          })
          const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce)
          const cipherText = Buffer.concat([cipher.update(e164, "utf8"), cipher.final()])
          const authTag = cipher.getAuthTag()
          const blob = Buffer.concat([version, nonce, cipherText, authTag])

          const encrypted = EncryptedPhoneNumber(blob.toString("base64url"))

          return { encrypted, hash }
        },
        Effect.catch((error) =>
          Effect.fail(
            new PhoneNumberEncryptionError({
              message: error.message,
              cause: error,
            }),
          ),
        ),
      )

      const decrypt = Effect.fn("PhoneNumberEncryptionService.decrypt")(
        function* ({ encrypted }: { encrypted: EncryptedPhoneNumber }) {
          const blob = yield* Effect.try({
            try: () => Buffer.from(encrypted, "base64url"),
            catch: (error) =>
              new PhoneNumberEncryptionError({
                message: "Failed to decrypt phone number",
                cause: error,
              }),
          })

          const version = blob[0]
          if (version !== 1) {
            return yield* Effect.fail(
              new PhoneNumberEncryptionError({ message: "Invalid version" }),
            )
          }
          const nonce = blob.subarray(1, 13)
          const authTag = blob.subarray(blob.length - 16)
          const cipherText = blob.subarray(13, blob.length - 16)

          const decipher = createDecipheriv("aes-256-gcm", encryptionKey, nonce)
          decipher.setAuthTag(authTag)

          const result = yield* Effect.try({
            try: () =>
              Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8"),
            catch: (error) =>
              new PhoneNumberEncryptionError({
                message: "Failed to decrypt phone number",
                cause: error,
              }),
          })
          return result
        },
        Effect.catch((error) =>
          Effect.fail(
            new PhoneNumberEncryptionError({
              message: error.message,
              cause: error,
            }),
          ),
        ),
      )

      const hashLookup = Effect.fn("PhoneNumberEncryptionService.hashLookup")(
        function* ({ phoneNumber }: { phoneNumber: string }) {
          const parsed = yield* Effect.try({
            try: () => parsePhoneNumberWithError(phoneNumber),
            catch: (error) =>
              new PhoneNumberEncryptionError({
                message: "Failed to parse phone number",
                cause: error,
              }),
          })
          const e164 = parsed.format("E.164")
          const hash = PhoneHash(createHmac("sha256", hmacKey).update(e164).digest("base64url"))
          return hash
        },
        Effect.catch((error) =>
          Effect.fail(
            new PhoneNumberEncryptionError({
              message: error.message,
              cause: error,
            }),
          ),
        ),
      )

      return {
        encrypt,
        decrypt,
        hashLookup,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
