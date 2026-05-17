import { Effect, Layer, Option, Context } from 'effect'
import { DrizzleClient } from '../drizzle-client'
import { eq, inArray } from 'drizzle-orm'
import {
  marathons,
  participants,
  validationResults,
  submissions,
  zippedSubmissions,
  juryInvitations,
  contactSheets,
  votingSession,
} from '../schema'
import { topics } from '../schema'
import { competitionClasses } from '../schema'
import { deviceGroups } from '../schema'
import { ruleConfigs } from '../schema'
import { sponsors } from '../schema'
import { participantVerifications } from '../schema'
import type {
  CompetitionClass,
  DeviceGroup,
  Marathon,
  NewMarathon,
  RuleConfig,
  Sponsor,
  Topic,
} from '../types'
import { DbError } from '../utils'
interface MarathonWithTopicsAndCompetitionClasses extends Marathon {
  topics: Topic[]
  competitionClasses: CompetitionClass[]
}

interface MarathonWithOptions extends Marathon {
  topics: Topic[]
  sponsors: Sponsor[]
  ruleConfigs: RuleConfig[]
  competitionClasses: CompetitionClass[]
  deviceGroups: DeviceGroup[]
}

export class MarathonsRepository extends Context.Service<
  MarathonsRepository,
  {
    /** All marathons with nested topics and competition classes. */
    readonly getMarathons: () => Effect.Effect<MarathonWithTopicsAndCompetitionClasses[], DbError>
    /** Marathon row by primary key, or none if missing. */
    readonly getMarathonById: (params: {
      id: number
    }) => Effect.Effect<Option.Option<Marathon>, DbError>
    /** Marathon row by public domain slug, or none if missing. */
    readonly getMarathonByDomain: (params: {
      domain: string
    }) => Effect.Effect<Option.Option<Marathon>, DbError>
    /** Marathon with topics, sponsors, rules, classes, and device groups for a domain (setup / admin). */
    readonly getMarathonByDomainWithOptions: (params: {
      domain: string
    }) => Effect.Effect<Option.Option<MarathonWithOptions>, DbError>
    /** Insert a new marathon row. */
    readonly createMarathon: (params: { data: NewMarathon }) => Effect.Effect<Marathon, DbError>
    /** Patch fields on a marathon identified by id. */
    readonly updateMarathon: (params: {
      id: number
      data: Partial<NewMarathon>
    }) => Effect.Effect<Marathon, DbError>
    /** Patch fields on the marathon for the given domain. */
    readonly updateMarathonByDomain: (params: {
      domain: string
      data: Partial<NewMarathon>
    }) => Effect.Effect<Marathon, DbError>
    /** Delete a marathon by id. */
    readonly deleteMarathon: (params: { id: number }) => Effect.Effect<Marathon, DbError>
    /**
     * Hard reset: remove participants, submissions, jury, topics, classes, device groups, rules,
     * sponsors, and validation data, then clear core marathon fields back to an empty setup state.
     */
    readonly resetMarathon: (params: { id: number }) => Effect.Effect<{ id: number }, DbError>
    /**
     * Strip operational / seedable data for a marathon run (voting, participants, submissions,
     * topics, classes, device groups, etc.) while leaving marathon configuration such as sponsors
     * and rule configs intact.
     */
    readonly clearOperationalSeedableData: (params: {
      id: number
    }) => Effect.Effect<{ id: number }, DbError>
  }
>()('@blikka/db/marathons-repository') {}

const makeMarathonsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient
  const getMarathons: MarathonsRepository['Service']['getMarathons'] = Effect.fn(
    'MarathonsRepository.getMarathons',
  )(function* () {
    return yield* use((db) =>
      db.query.marathons.findMany({
        with: {
          competitionClasses: true,
          topics: true,
        },
      }),
    )
  })
  const getMarathonById: MarathonsRepository['Service']['getMarathonById'] = Effect.fn(
    'MarathonsRepository.getMarathonById',
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getMarathonByDomain: MarathonsRepository['Service']['getMarathonByDomain'] = Effect.fn(
    'MarathonsRepository.getMarathonByDomain',
  )(function* ({ domain }) {
    const result = yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.domain, domain),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getMarathonByDomainWithOptions: MarathonsRepository['Service']['getMarathonByDomainWithOptions'] =
    Effect.fn('MarathonsRepository.getMarathonByDomainWithOptions')(function* ({ domain }) {
      const result = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            competitionClasses: true,
            topics: true,
            deviceGroups: true,
            sponsors: true,
            ruleConfigs: true,
          },
        }),
      )
      return Option.fromNullishOr(result)
    })
  const createMarathon: MarathonsRepository['Service']['createMarathon'] = Effect.fn(
    'MarathonsRepository.createMarathon',
  )(function* ({ data }) {
    const [result] = yield* use((db) => db.insert(marathons).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to create marathon',
        }),
      )
    }
    return result
  })
  const updateMarathon: MarathonsRepository['Service']['updateMarathon'] = Effect.fn(
    'MarathonsRepository.updateMarathon',
  )(function* ({ id, data }) {
    const [result] = yield* use((db) =>
      db.update(marathons).set(data).where(eq(marathons.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to update marathon',
        }),
      )
    }
    return result
  })
  const updateMarathonByDomain: MarathonsRepository['Service']['updateMarathonByDomain'] =
    Effect.fn('MarathonsRepository.updateMarathonByDomain')(function* ({ domain, data }) {
      if (!data.updatedAt) {
        data.updatedAt = new Date().toISOString()
      }
      const [result] = yield* use((db) =>
        db.update(marathons).set(data).where(eq(marathons.domain, domain)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to update marathon by domain',
          }),
        )
      }
      return result
    })
  const deleteMarathon: MarathonsRepository['Service']['deleteMarathon'] = Effect.fn(
    'MarathonsRepository.deleteMarathon',
  )(function* ({ id }) {
    const [result] = yield* use((db) =>
      db.delete(marathons).where(eq(marathons.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to delete marathon',
        }),
      )
    }
    return result
  })
  const resetMarathon: MarathonsRepository['Service']['resetMarathon'] = Effect.fn(
    'MarathonsRepository.resetMarathon',
  )(function* ({ id }) {
    const marathon = yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )
    if (!marathon) {
      return yield* Effect.fail(
        new DbError({
          message: 'Marathon not found',
        }),
      )
    }
    const marathonParticipants = yield* use((db) =>
      db.select({ id: participants.id }).from(participants).where(eq(participants.marathonId, id)),
    )
    const participantIds = marathonParticipants.map((p) => p.id)
    if (participantIds.length > 0) {
      yield* use((db) =>
        db
          .delete(validationResults)
          .where(inArray(validationResults.participantId, participantIds)),
      )
    }
    if (participantIds.length > 0) {
      yield* use((db) =>
        db
          .delete(participantVerifications)
          .where(inArray(participantVerifications.participantId, participantIds)),
      )
    }
    yield* use((db) => db.delete(submissions).where(eq(submissions.marathonId, id)))
    yield* use((db) => db.delete(zippedSubmissions).where(eq(zippedSubmissions.marathonId, id)))
    yield* use((db) => db.delete(participants).where(eq(participants.marathonId, id)))
    yield* use((db) => db.delete(juryInvitations).where(eq(juryInvitations.marathonId, id)))
    yield* use((db) => db.delete(topics).where(eq(topics.marathonId, id)))
    yield* use((db) => db.delete(competitionClasses).where(eq(competitionClasses.marathonId, id)))
    yield* use((db) => db.delete(deviceGroups).where(eq(deviceGroups.marathonId, id)))
    yield* use((db) => db.delete(ruleConfigs).where(eq(ruleConfigs.marathonId, id)))
    yield* use((db) => db.delete(sponsors).where(eq(sponsors.marathonId, id)))
    yield* use((db) =>
      db
        .update(marathons)
        .set({
          setupCompleted: false,
          updatedAt: new Date().toISOString(),
          startDate: null,
          endDate: null,
          name: '',
          description: null,
          logoUrl: null,
          languages: 'en',
          termsAndConditionsKey: null,
        })
        .where(eq(marathons.id, id)),
    )
    return { id }
  })
  const clearOperationalSeedableData: MarathonsRepository['Service']['clearOperationalSeedableData'] =
    Effect.fn('MarathonsRepository.clearOperationalSeedableData')(function* ({ id }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.id, id),
        }),
      )
      if (!marathon) {
        return yield* Effect.fail(
          new DbError({
            message: 'Marathon not found',
          }),
        )
      }

      const marathonParticipants = yield* use((db) =>
        db
          .select({ id: participants.id })
          .from(participants)
          .where(eq(participants.marathonId, id)),
      )
      const participantIds = marathonParticipants.map((participant) => participant.id)

      yield* use((db) => db.delete(votingSession).where(eq(votingSession.marathonId, id)))

      if (participantIds.length > 0) {
        yield* use((db) =>
          db
            .delete(validationResults)
            .where(inArray(validationResults.participantId, participantIds)),
        )
        yield* use((db) =>
          db
            .delete(participantVerifications)
            .where(inArray(participantVerifications.participantId, participantIds)),
        )
        yield* use((db) =>
          db.delete(contactSheets).where(inArray(contactSheets.participantId, participantIds)),
        )
        yield* use((db) =>
          db
            .delete(zippedSubmissions)
            .where(inArray(zippedSubmissions.participantId, participantIds)),
        )
      }

      yield* use((db) => db.delete(submissions).where(eq(submissions.marathonId, id)))
      yield* use((db) => db.delete(participants).where(eq(participants.marathonId, id)))
      yield* use((db) => db.delete(juryInvitations).where(eq(juryInvitations.marathonId, id)))
      yield* use((db) => db.delete(topics).where(eq(topics.marathonId, id)))
      yield* use((db) => db.delete(competitionClasses).where(eq(competitionClasses.marathonId, id)))
      yield* use((db) => db.delete(deviceGroups).where(eq(deviceGroups.marathonId, id)))

      return { id }
    })
  return MarathonsRepository.of({
    getMarathons,
    getMarathonById,
    getMarathonByDomain,
    getMarathonByDomainWithOptions,
    createMarathon,
    updateMarathon,
    updateMarathonByDomain,
    deleteMarathon,
    resetMarathon,
    clearOperationalSeedableData,
  })
})

export const MarathonsRepositoryLayerNoDeps = Layer.effect(
  MarathonsRepository,
  makeMarathonsRepository,
)

export const MarathonsRepositoryLayer = MarathonsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
