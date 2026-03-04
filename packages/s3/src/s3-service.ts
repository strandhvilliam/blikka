import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { Duration, Effect, Option, Schedule, Schema, ServiceMap, Layer } from "effect"
import { S3EffectClient } from "./s3-effect-client"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

class S3ClientError extends Schema.TaggedErrorClass<S3ClientError>()(
  "S3ClientError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export class S3Service extends ServiceMap.Service<S3Service>()("@blikka/packages/s3-service", {
  make: Effect.gen(function* () {
    const s3Client = yield* S3EffectClient

    const getFile = Effect.fn("S3Service.getFile")(
      function* (bucket: string, key: string) {
        const file = yield* s3Client.use((client) =>
          client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        )

        if (!file.Body) {
          return Option.none<Uint8Array>()
        }
        const body = file.Body

        const buffer = yield* Effect.tryPromise({
          try: () => body.transformToByteArray(),
          catch: (error) =>
            new S3ClientError({
              cause: error,
              message: "Failed to transform to byte array",
            }),
        })
        return Option.some<Uint8Array>(buffer)
      },
      Effect.mapError((error) => {
        return new S3ClientError({
          cause: error,
          message: "Unexpected S3 error",
        })
      })
    )

    const getHead = Effect.fn("S3Service.getHead")(
      function* (bucket: string, key: string) {
        const head = yield* s3Client.use((client) =>
          client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        )
        return head
      },
      Effect.mapError((error) => {
        return new S3ClientError({
          cause: error,
          message: "Unexpected S3 error",
        })
      })
    )

    const getPresignedUrl = Effect.fn("S3Service.getPresignedUrl")(
      function* (
        bucket: string,
        key: string,
        method: "GET" | "PUT" = "GET",
        options?: { expiresIn?: number; contentType?: string }
      ) {
        const command =
          method === "GET"
            ? new GetObjectCommand({
              Bucket: bucket,
              Key: key,
            })
            : new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              ContentType: options?.contentType ?? "image/jpeg",
            })

        return yield* s3Client.use((client) =>
          getSignedUrl(client, command, {
            expiresIn: options?.expiresIn ?? 60 * 60 * 24,
          })
        )
      },
      Effect.mapError((error) => {
        return new S3ClientError({
          cause: error,
          message: "Unexpected S3 error",
        })
      })
    )

    const putFile = Effect.fn("S3Service.putFile")(
      function* (bucket: string, key: string, file: Buffer) {
        const putObjectCommand = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file,
        })
        return yield* s3Client.use((client) => client.send(putObjectCommand))
      },
      Effect.retry(
        Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
      ),
      Effect.mapError((error) => {
        return new S3ClientError({
          cause: error,
          message: "Unexpected S3 error",
        })
      })
    )

    const generateSubmissionKey = Effect.fnUntraced(function* (
      domain: string,
      reference: string,
      orderIndex: number,
      filenamePrefix?: string
    ) {
      const dateTime = new Date().toISOString().replace(/[:.]/g, "-")
      const formattedOrderIndex = (orderIndex + 1).toString().padStart(2, "0")
      const prefix = filenamePrefix ? `${filenamePrefix}_` : ""
      return `${domain}/${reference}/${formattedOrderIndex}/${prefix}${reference}_${formattedOrderIndex}_${dateTime}.jpg`
    })

    return {
      getFile,
      getHead,
      getPresignedUrl,
      putFile,
      generateSubmissionKey,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(Layer.provide(S3EffectClient.layer))
}
