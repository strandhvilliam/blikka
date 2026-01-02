"use server"

import { Action, toActionResponse } from "@/lib/next-utils"
import { Effect, Config } from "effect"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Schema } from "effect"

const GetTermsUploadUrlInputSchema = Schema.Struct({
  domain: Schema.String,
})

type GetTermsUploadUrlInput = Schema.Schema.Type<typeof GetTermsUploadUrlInputSchema>

const _getTermsUploadUrlAction = Effect.fn("@blikka/web/getTermsUploadUrlAction")(function* (
  input: GetTermsUploadUrlInput
) {
  const bucketName = yield* Config.string("MARATHON_SETTINGS_BUCKET_NAME").pipe(
    Config.withDefault("marathon-settings-bucket")
  )

  const s3 = new S3Client({ region: "eu-north-1" })
  const key = `${input.domain}/terms-and-conditions.txt`
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: "text/plain",
  })
  const url = yield* Effect.tryPromise({
    try: () => getSignedUrl(s3, command, { expiresIn: 60 * 5 }),
    catch: (error) => new Error(`Failed to generate presigned URL: ${error}`),
  })

  return { url, key }
}, toActionResponse)

export const getTermsUploadUrlAction = async (input: GetTermsUploadUrlInput) =>
  Action(_getTermsUploadUrlAction)(input)
