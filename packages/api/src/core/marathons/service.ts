import 'server-only'

import { Effect, Result, Option, Config, Context, Layer } from 'effect'
import {
  DbLayer,
  CompetitionClassesRepository,
  MarathonsRepository,
  RulesRepository,
  UsersRepository,
  DbError,
  type CompetitionClass,
  type DeviceGroup,
  type Marathon,
  type NewMarathon,
  type RuleConfig,
  type Sponsor,
  type Topic,
} from '@blikka/db'
import { S3Service, S3ServiceLayer, type S3ClientError } from '@blikka/aws'
import { NotFoundError, failNotFoundIfNone } from '../errors'
import { RULE_KEYS } from '@blikka/validation'
import type {
  GetByDomainInput,
  GetCurrentTermsInput,
  GetLogoUploadUrlInput,
  GetTermsUploadUrlInput,
  GetUserMarathonsInput,
  ResetMarathonInput,
  UpdateMarathonInput,
} from './contracts'

import { buildVirtualHostedS3Url } from '../shared'

function extractLogoVersion(currentKey?: string | null) {
  if (!currentKey) return undefined

  try {
    const url = new URL(currentKey)
    const decodedPath = decodeURIComponent(url.pathname)
    return decodedPath.split('?')[1]?.split('=')[1]
  } catch {
    return currentKey.split('?')[1]?.split('=')[1]
  }
}

interface MarathonWithOptions extends Marathon {
  topics: Topic[]
  sponsors: Sponsor[]
  ruleConfigs: RuleConfig[]
  competitionClasses: CompetitionClass[]
  deviceGroups: DeviceGroup[]
}

interface MarathonWithRole extends Marathon {
  role: string
}

export class MarathonService extends Context.Service<
  MarathonService,
  {
    /**
     * Loads the marathon for `domain` with topics, sponsors, rule configs, classes, and device groups;
     * ensures a default competition class exists when mode is `by-camera` and none are configured.
     */
    readonly getMarathonByDomain: (
      input: GetByDomainInput,
    ) => Effect.Effect<MarathonWithOptions, DbError | NotFoundError, never>

    /** Marathons the user can access, each with the relation `role`. */
    readonly getUserMarathons: (
      input: GetUserMarathonsInput,
    ) => Effect.Effect<MarathonWithRole[], DbError, never>

    /** Patches marathon fields by `domain` and syncs within-timerange rule params when dates change. */
    readonly updateMarathon: (
      input: UpdateMarathonInput,
    ) => Effect.Effect<Marathon, DbError | NotFoundError, never>

    /**
     * Hard-resets marathon data keyed by `domain` (participants, submissions, topics, etc. per repository).
     */
    readonly resetMarathon: (
      input: ResetMarathonInput,
    ) => Effect.Effect<{ id: number }, DbError | NotFoundError, never>

    /** Presigned PUT URL for a versioned logo object plus the public URL after upload. */
    readonly getLogoUploadUrl: (
      input: GetLogoUploadUrlInput,
    ) => Effect.Effect<
      { url: string; key: string; publicUrl: string },
      S3ClientError | Config.ConfigError,
      never
    >

    /** Presigned PUT for marathon terms-and-conditions text at a fixed key under `domain`. */
    readonly getTermsUploadUrl: (
      input: GetTermsUploadUrlInput,
    ) => Effect.Effect<{ url: string; key: string }, S3ClientError | Config.ConfigError, never>

    /** Reads current terms object from storage, or empty string if missing or unreadable. */
    readonly getCurrentTerms: (
      input: GetCurrentTermsInput,
    ) => Effect.Effect<string, Config.ConfigError, never>
  }
>()('@blikka/api/MarathonService') {}

const makeMarathonService = Effect.gen(function* () {
  const usersRepository = yield* UsersRepository
  const rulesRepository = yield* RulesRepository
  const marathonsRepository = yield* MarathonsRepository
  const competitionClassesRepository = yield* CompetitionClassesRepository
  const s3 = yield* S3Service

  const getMarathonByDomain: MarathonService['Service']['getMarathonByDomain'] = Effect.fn(
    'MarathonService.getMarathonByDomain',
  )(function* ({ domain }) {
    const result = yield* marathonsRepository
      .getMarathonByDomainWithOptions({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    if (result.mode === 'by-camera' && result.competitionClasses.length === 0) {
      yield* competitionClassesRepository.createCompetitionClass({
        data: {
          name: 'Default',
          numberOfPhotos: 1,
          marathonId: result.id,
          description: 'Default competition class for by-camera competitions',
        },
      })
    }

    return result
  })

  const getUserMarathons: MarathonService['Service']['getUserMarathons'] = Effect.fn(
    'MarathonService.getUserMarathons',
  )(function* ({ userId }) {
    return yield* usersRepository.getMarathonsByUserId({ userId })
  })

  const updateMarathon: MarathonService['Service']['updateMarathon'] = Effect.fn(
    'MarathonService.updateMarathon',
  )(function* ({ domain, data }) {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<NewMarathon>

    const result = yield* marathonsRepository.updateMarathonByDomain({
      domain,
      data: updateData,
    })

    if (data.startDate !== undefined || data.endDate !== undefined) {
      const rules = yield* rulesRepository.getRulesByDomain({ domain })
      const withinTimerangeRule = rules.find((rule) => rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE)

      if (withinTimerangeRule) {
        const finalMarathon = yield* marathonsRepository
          .getMarathonByDomain({ domain })
          .pipe(failNotFoundIfNone('Marathon', { domain }))

        yield* rulesRepository.updateRuleConfig({
          id: withinTimerangeRule.id,
          data: {
            params: {
              start: finalMarathon.startDate,
              end: finalMarathon.endDate,
            },
          },
        })
      }
    }

    return result
  })

  const resetMarathon: MarathonService['Service']['resetMarathon'] = Effect.fn(
    'MarathonService.resetMarathon',
  )(function* ({ domain }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    return yield* marathonsRepository.resetMarathon({ id: marathon.id })
  })

  const getLogoUploadUrl: MarathonService['Service']['getLogoUploadUrl'] = Effect.fn(
    'MarathonService.getLogoUploadUrl',
  )(function* ({ domain, currentKey }) {
    const bucketName = yield* Config.string('MARATHON_SETTINGS_BUCKET_NAME')

    const version = extractLogoVersion(currentKey)
    const newVersion = version ? parseInt(version) + 1 : 1

    const key = `${domain}/logo?v=${newVersion}`
    const url = yield* s3.getPresignedUrl(bucketName, key, 'PUT', {
      expiresIn: 60 * 5,
    })

    const publicUrl = buildVirtualHostedS3Url(bucketName, key)!

    return { url, key, publicUrl }
  })

  const getTermsUploadUrl: MarathonService['Service']['getTermsUploadUrl'] = Effect.fn(
    'MarathonService.getTermsUploadUrl',
  )(function* ({ domain }) {
    const bucketName = yield* Config.string('MARATHON_SETTINGS_BUCKET_NAME')

    const key = `${domain}/terms-and-conditions.txt`
    const url = yield* s3.getPresignedUrl(bucketName, key, 'PUT', {
      expiresIn: 60 * 5,
      contentType: 'text/plain',
    })

    return { url, key }
  })

  const getCurrentTerms: MarathonService['Service']['getCurrentTerms'] = Effect.fn(
    'MarathonService.getCurrentTerms',
  )(function* ({ domain }) {
    const bucketName = yield* Config.string('MARATHON_SETTINGS_BUCKET_NAME')

    const key = `${domain}/terms-and-conditions.txt`
    const fileDataEither = yield* Effect.result(s3.getFile(bucketName, key))

    if (Result.isFailure(fileDataEither)) {
      return yield* Effect.succeed('')
    }

    return yield* Option.match(fileDataEither.success, {
      onSome: (data) => {
        const decoder = new TextDecoder()
        return Effect.succeed(decoder.decode(data))
      },
      onNone: () => Effect.succeed(''),
    })
  })

  return MarathonService.of({
    getMarathonByDomain,
    getUserMarathons,
    updateMarathon,
    resetMarathon,
    getLogoUploadUrl,
    getTermsUploadUrl,
    getCurrentTerms,
  })
})

export const MarathonServiceLayerNoDeps = Layer.effect(MarathonService, makeMarathonService)

export const MarathonServiceLayer = MarathonServiceLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, S3ServiceLayer)),
)
