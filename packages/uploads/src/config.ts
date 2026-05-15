import { Config, Effect, Layer, Context } from "effect"

export class UploadsConfig extends Context.Service<
  UploadsConfig,
  {
    readonly submissionsBucketName: string
    readonly thumbnailsBucketName: string
    readonly contactSheetsBucketName: string
    readonly zipsBucketName: string
  }
>()("@blikka/uploads/UploadsConfig", {
  make: Effect.gen(function* () {
    const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
    const thumbnailsBucketName = yield* Config.string("THUMBNAILS_BUCKET_NAME")
    const contactSheetsBucketName = yield* Config.string("CONTACT_SHEETS_BUCKET_NAME")
    const zipsBucketName = yield* Config.string("ZIPS_BUCKET_NAME")
    return {
      submissionsBucketName,
      thumbnailsBucketName,
      contactSheetsBucketName,
      zipsBucketName,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
