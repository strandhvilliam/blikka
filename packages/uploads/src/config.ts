import { Config, Effect, Layer, Context } from 'effect'

export class UploadsConfig extends Context.Service<
  UploadsConfig,
  {
    readonly submissionsBucketName: string
    readonly sponsorsBucketName: string
    readonly thumbnailsBucketName: string
    readonly contactSheetsBucketName: string
    readonly zipsBucketName: string
  }
>()('@blikka/uploads/UploadsConfig') {}

export const UploadsConfigLayer = Layer.effect(
  UploadsConfig,

  Effect.gen(function* () {
    const submissionsBucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
    const sponsorsBucketName = yield* Config.string('SPONSORS_BUCKET_NAME')
    const thumbnailsBucketName = yield* Config.string('THUMBNAILS_BUCKET_NAME')
    const contactSheetsBucketName = yield* Config.string('CONTACT_SHEETS_BUCKET_NAME')
    const zipsBucketName = yield* Config.string('ZIPS_BUCKET_NAME')
    return {
      submissionsBucketName,
      sponsorsBucketName,
      thumbnailsBucketName,
      contactSheetsBucketName,
      zipsBucketName,
    } as const
  }),
)
