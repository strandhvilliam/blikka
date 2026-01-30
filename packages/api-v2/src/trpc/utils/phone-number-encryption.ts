import { Brand, Config, Context, Effect, Layer, Schema } from "effect";
import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import {
  parsePhoneNumberWithError,
} from 'libphonenumber-js';


export class PhoneNumberEncryptionError extends Schema.TaggedError<PhoneNumberEncryptionError>()(
  "@blikka/api-v2/PhoneNumberEncryptionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export type EncryptedPhoneNumber = string &
  Brand.Brand<"EncryptedPhoneNumber">;
export const EncryptedPhoneNumber =
  Brand.nominal<EncryptedPhoneNumber>();

export type PhoneHash = string & Brand.Brand<"PhoneHash">;
export const PhoneHash = Brand.nominal<PhoneHash>();


export class PhoneNumberEncryptionService extends Context.Tag("@blikka/api-v2/PhoneNumberEncryptionService")<PhoneNumberEncryptionService, {
  readonly encrypt: ({ phoneNumber }: { phoneNumber: string }) => Effect.Effect<{ encrypted: EncryptedPhoneNumber, hash: PhoneHash }, PhoneNumberEncryptionError, never>;
  readonly decrypt: ({ encrypted }: { encrypted: EncryptedPhoneNumber }) => Effect.Effect<string, PhoneNumberEncryptionError, never>;
  readonly hashLookup: ({ phoneNumber }: { phoneNumber: string }) => Effect.Effect<PhoneHash, PhoneNumberEncryptionError, never>;
}>() {

  static readonly layer = Layer.effect(PhoneNumberEncryptionService, Effect.gen(function*() {

    const encryptionKey = yield* Config.string("ENCRYPTION_KEY").pipe(
      Effect.map((key) => Buffer.from(key, 'hex'))
    );
    const hmacKey = yield* Config.string("HMAC_KEY");

    const encrypt = Effect.fn("PhoneNumberEncryptionService.encrypt")(function*({ phoneNumber }: { phoneNumber: string }) {

      const parsed = yield* Effect.try(() => parsePhoneNumberWithError(phoneNumber))
      const e164 = parsed.format('E.164');

      const hash = PhoneHash(createHmac('sha256', hmacKey).update(e164).digest('base64url'))

      const version = Buffer.from([1]);
      const nonce = yield* Effect.try(() => randomBytes(12))
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce)
      const cipherText = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()])
      const authTag = cipher.getAuthTag()
      const blob = Buffer.concat([version, nonce, cipherText, authTag])

      const encrypted = EncryptedPhoneNumber(blob.toString('base64url'))

      return { encrypted, hash };
    }, 
      Effect.catchAll((error) => 
        Effect.fail(
          new PhoneNumberEncryptionError({ 
            message: error.message, 
            cause: error 
          })
        )
      ))

    const decrypt = Effect.fn("PhoneNumberEncryptionService.decrypt")(function*({ encrypted }: { encrypted: EncryptedPhoneNumber }) {

      const blob = yield* Effect.try(() =>
        Buffer.from(encrypted, "base64url")
      );

      const version = blob[0]
      if (version !== 1) {
        return yield* Effect.fail(new PhoneNumberEncryptionError({ message: 'Invalid version' }));
      }
      const nonce = blob.subarray(1, 13)
      const authTag = blob.subarray(blob.length - 16)
      const cipherText = blob.subarray(13, blob.length - 16)

      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, nonce)
      decipher.setAuthTag(authTag)

      const result = yield* Effect.try(() => Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8'))
      return result;
    }, Effect.catchAll((error) => 
      Effect.fail(
        new PhoneNumberEncryptionError({ 
          message: error.message, 
          cause: error 
        })
      )
    ));

    const hashLookup = Effect.fn("PhoneNumberEncryptionService.hashLookup")(function*({ phoneNumber }: { phoneNumber: string }) {
      const parsed = yield* Effect.try(() => parsePhoneNumberWithError(phoneNumber))
      const e164 = parsed.format('E.164');
      const hash = PhoneHash(createHmac('sha256', hmacKey).update(e164).digest('base64url'))
      return hash;
    }, Effect.catchAll((error) => 
      Effect.fail(
        new PhoneNumberEncryptionError({ 
          message: error.message, 
          cause: error 
        })
      )
    ));

    return {
      encrypt,
      decrypt,
      hashLookup,
    } as const
  }))
} 