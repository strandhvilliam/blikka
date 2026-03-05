import { Schema } from "effect";

export const S3EventSchema = Schema.Struct({
  Records: Schema.Array(
    Schema.Struct({
      s3: Schema.Struct({
        object: Schema.Struct({
          key: Schema.String,
        }),
        bucket: Schema.Struct({
          name: Schema.String,
        }),
      }),
    }),
  ),
})

export const DirectMessageSchema = Schema.Struct({
  submissionKeys: Schema.Array(Schema.String),
})
