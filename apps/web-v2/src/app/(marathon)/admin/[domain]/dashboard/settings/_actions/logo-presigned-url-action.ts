"use server"

import { Action, toActionResponse } from "@/lib/next-utils"
import { Effect, Config } from "effect"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Schema } from "effect"

const GetLogoUploadUrlInputSchema = Schema.Struct({
  domain: Schema.String,
  currentKey: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
})

type GetLogoUploadUrlInput = Schema.Schema.Type<typeof GetLogoUploadUrlInputSchema>

const _getLogoUploadUrlAction = Effect.fn("@blikka/web/getLogoUploadUrlAction")(function* (
  input: GetLogoUploadUrlInput
) {
  const bucketName = yield* Config.string("MARATHON_SETTINGS_BUCKET_NAME").pipe(
    Config.withDefault("marathon-settings-bucket")
  )

  const version = input.currentKey ? input.currentKey.split("?")[1]?.split("=")[1] : undefined

  const newVersion = version ? parseInt(version) + 1 : 1

  const s3 = new S3Client({ region: "eu-north-1" })
  const key = `${input.domain}/logo?v=${newVersion}`
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
  })
  const url = yield* Effect.tryPromise({
    try: () => getSignedUrl(s3, command, { expiresIn: 60 * 5 }),
    catch: (error) => new Error(`Failed to generate presigned URL: ${error}`),
  })

  return { url, key }
}, toActionResponse)

export const getLogoUploadUrlAction = async (input: GetLogoUploadUrlInput) =>
  Action(_getLogoUploadUrlAction)(input)
