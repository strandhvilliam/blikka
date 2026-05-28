
import { Effect, Layer, Context } from 'effect'
import {
  DbLayer,
  CompetitionClassesRepository,
  MarathonsRepository,
  DbError,
  type CompetitionClass,
} from '@blikka/db'
import type {
  CreateCompetitionClassInput,
  DeleteCompetitionClassInput,
  UpdateCompetitionClassInput,
} from './contracts'
import { ForbiddenError, NotFoundError, failNotFoundIfNone } from '../errors'
import { PublicMarathonCache, PublicMarathonCacheLayer } from '../upload-flow/public-marathon-cache'

export class CompetitionClassesService extends Context.Service<
  CompetitionClassesService,
  {
    /**
     * Creates a competition class for the marathon resolved from `domain`, defaulting `topicStartIndex`
     * to 0 when omitted.
     */
    readonly createCompetitionClass: (
      input: CreateCompetitionClassInput,
    ) => Effect.Effect<CompetitionClass, NotFoundError | DbError, never>

    /**
     * Partially updates a competition class scoped to `domain`; fails when the row is missing
     * or belongs to another marathon.
     */
    readonly updateCompetitionClass: (
      input: UpdateCompetitionClassInput,
    ) => Effect.Effect<CompetitionClass, NotFoundError | ForbiddenError | DbError, never>

    /** Deletes a competition class by `id` after verifying it is owned by the marathon on `domain`. */
    readonly deleteCompetitionClass: (
      input: DeleteCompetitionClassInput,
    ) => Effect.Effect<CompetitionClass, NotFoundError | ForbiddenError | DbError, never>
  }
>()('@blikka/api/CompetitionClassesService') {}

const makeCompetitionClassesService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const competitionClassesRepository = yield* CompetitionClassesRepository
  const publicMarathonCache = yield* PublicMarathonCache

  const ensureClassBelongsToDomain = Effect.fn(
    'CompetitionClassesService.ensureClassBelongsToDomain',
  )(function* ({ id, domain }: { id: number; domain: string }) {
    const competitionClass = yield* competitionClassesRepository
      .getCompetitionClassById({ id })
      .pipe(failNotFoundIfNone('CompetitionClass', { id }))

    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    if (marathon.id !== competitionClass.marathonId) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: `Competition class ${id} does not belong to domain ${domain}`,
        }),
      )
    }

    return competitionClass
  })

  const createCompetitionClass: CompetitionClassesService['Service']['createCompetitionClass'] =
    Effect.fn('CompetitionClassesService.createCompetitionClass')(function* ({ data, domain }) {
      const marathon = yield* marathonsRepository
        .getMarathonByDomain({ domain })
        .pipe(failNotFoundIfNone('Marathon', { domain }))

      const competitionClass = yield* competitionClassesRepository.createCompetitionClass({
        data: {
          ...data,
          marathonId: marathon.id,
          topicStartIndex: data.topicStartIndex ?? 0,
        },
      })
      yield* publicMarathonCache.invalidate(domain)
      return competitionClass
    })

  const updateCompetitionClass: CompetitionClassesService['Service']['updateCompetitionClass'] =
    Effect.fn('CompetitionClassesService.updateCompetitionClass')(function* ({ id, data, domain }) {
      yield* ensureClassBelongsToDomain({ id, domain })
      const competitionClass = yield* competitionClassesRepository.updateCompetitionClass({
        id,
        data,
      })
      yield* publicMarathonCache.invalidate(domain)
      return competitionClass
    })

  const deleteCompetitionClass: CompetitionClassesService['Service']['deleteCompetitionClass'] =
    Effect.fn('CompetitionClassesService.deleteCompetitionClass')(function* ({ id, domain }) {
      yield* ensureClassBelongsToDomain({ id, domain })
      const competitionClass = yield* competitionClassesRepository.deleteCompetitionClass({
        id,
      })
      yield* publicMarathonCache.invalidate(domain)
      return competitionClass
    })

  return CompetitionClassesService.of({
    createCompetitionClass,
    updateCompetitionClass,
    deleteCompetitionClass,
  })
})

export const CompetitionClassesServiceLayerNoDeps = Layer.effect(
  CompetitionClassesService,
  makeCompetitionClassesService,
)

export const CompetitionClassesServiceLayer = CompetitionClassesServiceLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, PublicMarathonCacheLayer)),
)
