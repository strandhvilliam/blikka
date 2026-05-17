import { Effect, Layer, Option, Context } from 'effect'
import { sponsors } from '../schema'
import { DrizzleClient } from '../drizzle-client'
import { eq } from 'drizzle-orm'
import type { NewSponsor, Sponsor } from '../types'
import { DbError } from '../utils'
export class SponsorsRepository extends Context.Service<
  SponsorsRepository,
  {
    /** Sponsors belonging to a marathon. */
    readonly getSponsorsByMarathonId: (params: {
      marathonId: number
    }) => Effect.Effect<Sponsor[], DbError>
    /** Latest sponsor of a type for a marathon, or none if missing. */
    readonly getLatestSponsorByType: (params: {
      marathonId: number
      type: string
    }) => Effect.Effect<Option.Option<Sponsor>, DbError>
    /** Sponsors of a type for a marathon. */
    readonly getSponsorsByType: (params: {
      marathonId: number
      type: string
    }) => Effect.Effect<Sponsor[], DbError>
    /** Sponsor row by primary key, or none if missing. */
    readonly getSponsorById: (params: {
      id: number
    }) => Effect.Effect<Option.Option<Sponsor>, DbError>
    /** Insert a new sponsor row. */
    readonly createSponsor: (params: { data: NewSponsor }) => Effect.Effect<Sponsor, DbError>
    /** Patch fields on a sponsor identified by id. */
    readonly updateSponsor: (params: {
      id: number
      data: Partial<NewSponsor>
    }) => Effect.Effect<Sponsor, DbError>
    /** Delete a sponsor by id. */
    readonly deleteSponsor: (params: { id: number }) => Effect.Effect<{ id: number }, DbError>
  }
>()('@blikka/db/sponsors-repository') {}

const makeSponsorsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient
  const getSponsorsByMarathonId: SponsorsRepository['Service']['getSponsorsByMarathonId'] =
    Effect.fn('SponsorsRepository.getSponsorsByMarathonId')(function* ({ marathonId }) {
      const result = yield* use((db) =>
        db.query.sponsors.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathonId),
        }),
      )
      return result
    })
  const getLatestSponsorByType: SponsorsRepository['Service']['getLatestSponsorByType'] = Effect.fn(
    'SponsorsRepository.getLatestSponsorByType',
  )(function* ({ marathonId, type }) {
    const result = yield* use((db) =>
      db.query.sponsors.findFirst({
        where: (table, operators) =>
          operators.and(operators.eq(table.marathonId, marathonId), operators.eq(table.type, type)),
        orderBy: (table, operators) => operators.desc(table.createdAt),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getSponsorsByType: SponsorsRepository['Service']['getSponsorsByType'] = Effect.fn(
    'SponsorsRepository.getSponsorsByType',
  )(function* ({ marathonId, type }) {
    const result = yield* use((db) =>
      db.query.sponsors.findMany({
        where: (table, operators) =>
          operators.and(operators.eq(table.marathonId, marathonId), operators.eq(table.type, type)),
      }),
    )
    return result
  })
  const getSponsorById: SponsorsRepository['Service']['getSponsorById'] = Effect.fn(
    'SponsorsRepository.getSponsorById',
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.sponsors.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const createSponsor: SponsorsRepository['Service']['createSponsor'] = Effect.fn(
    'SponsorsRepository.createSponsor',
  )(function* ({ data }) {
    const [result] = yield* use((db) =>
      db
        .insert(sponsors)
        .values({
          ...data,
          uploadedAt: data.uploadedAt || new Date().toISOString(),
        })
        .returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to create sponsor',
        }),
      )
    }
    return result
  })
  const updateSponsor: SponsorsRepository['Service']['updateSponsor'] = Effect.fn(
    'SponsorsRepository.updateSponsor',
  )(function* ({ id, data }) {
    const updateData = {
      ...data,
      ...(data.key && { uploadedAt: new Date().toISOString() }),
    }
    const [result] = yield* use((db) =>
      db.update(sponsors).set(updateData).where(eq(sponsors.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to update sponsor',
        }),
      )
    }
    return result
  })
  const deleteSponsor: SponsorsRepository['Service']['deleteSponsor'] = Effect.fn(
    'SponsorsRepository.deleteSponsor',
  )(function* ({ id }) {
    const [result] = yield* use((db) =>
      db.delete(sponsors).where(eq(sponsors.id, id)).returning({ id: sponsors.id }),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to delete sponsor',
        }),
      )
    }
    return result
  })
  return SponsorsRepository.of({
    getSponsorsByMarathonId,
    getLatestSponsorByType,
    getSponsorsByType,
    getSponsorById,
    createSponsor,
    updateSponsor,
    deleteSponsor,
  })
})

export const SponsorsRepositoryLayerNoDeps = Layer.effect(
  SponsorsRepository,
  makeSponsorsRepository,
)

export const SponsorsRepositoryLayer = SponsorsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
