
import { Config, Effect, Layer, Context } from 'effect'
import { DbLayer, DbError, MarathonsRepository, SponsorsRepository, type Sponsor } from '@blikka/db'
import { S3Service, S3ServiceLayer, type S3ClientError } from '@blikka/aws'
import type {
  CreateSponsorInput,
  GenerateSponsorUploadUrlInput,
  GetSponsorsByMarathonInput,
} from './contracts'
import { NotFoundError, failNotFoundIfNone } from '../errors'

export class SponsorsService extends Context.Service<
  SponsorsService,
  {
    /** Lists sponsors for the marathon tied to `domain`. */
    readonly getSponsorsByMarathon: (
      input: GetSponsorsByMarathonInput,
    ) => Effect.Effect<Sponsor[], DbError | NotFoundError, never>

    /** Creates a sponsor row under the marathon resolved from `domain`. */
    readonly createSponsor: (
      input: CreateSponsorInput,
    ) => Effect.Effect<Sponsor, DbError | NotFoundError, never>

    /** Issues a presigned PUT URL and random object key under `domain/sponsors/`. */
    readonly generateUploadUrl: (
      input: GenerateSponsorUploadUrlInput,
    ) => Effect.Effect<{ url: string; key: string }, S3ClientError | Config.ConfigError, never>
  }
>()('@blikka/api/sponsors-api-service') {}

const makeSponsorsService = Effect.gen(function* () {
  const sponsorsRepository = yield* SponsorsRepository
  const marathonsRepository = yield* MarathonsRepository
  const s3 = yield* S3Service

  const getSponsorsByMarathon: SponsorsService['Service']['getSponsorsByMarathon'] = Effect.fn(
    'SponsorsService.getSponsorsByMarathon',
  )(function* ({ domain }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    return yield* sponsorsRepository.getSponsorsByMarathonId({
      marathonId: marathon.id,
    })
  })

  const createSponsor: SponsorsService['Service']['createSponsor'] = Effect.fn(
    'SponsorsService.createSponsor',
  )(function* ({ domain, type, position, key }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    return yield* sponsorsRepository.createSponsor({
      data: {
        marathonId: marathon.id,
        type,
        position,
        key,
      },
    })
  })

  const generateUploadUrl: SponsorsService['Service']['generateUploadUrl'] = Effect.fn(
    'SponsorsService.generateUploadUrl',
  )(function* (input) {
    const { domain } = input
    const bucketName = yield* Config.string('SPONSORS_BUCKET_NAME')

    const fileId = crypto.randomUUID()
    const key = `${domain}/sponsors/${fileId}.jpg`

    const url = yield* s3.getPresignedUrl(bucketName, key, 'PUT', {
      expiresIn: 60 * 5,
      contentType: 'image/jpeg',
    })

    return { url, key }
  })

  return SponsorsService.of({
    getSponsorsByMarathon,
    createSponsor,
    generateUploadUrl,
  })
})

export const SponsorsServiceLayerNoDeps = Layer.effect(SponsorsService, makeSponsorsService)

export const SponsorsServiceLayer = SponsorsServiceLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, S3ServiceLayer)),
)
