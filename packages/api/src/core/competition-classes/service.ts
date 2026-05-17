import "server-only"

import { Effect, Layer, Option, Context } from "effect"
import {
  DbLayer,
  CompetitionClassesRepository,
  MarathonsRepository,
  DbError,
  type CompetitionClass,
} from "@blikka/db"
import type {
  CreateCompetitionClassInput,
  DeleteCompetitionClassInput,
  UpdateCompetitionClassInput,
} from "./contracts"
import { CompetitionClassApiError } from "./errors"

export class CompetitionClassesService extends Context.Service<
  CompetitionClassesService,
  {
    /**
     * Creates a competition class for the marathon resolved from `domain`, defaulting `topicStartIndex`
     * to 0 when omitted.
     */
    readonly createCompetitionClass: (
      input: CreateCompetitionClassInput,
    ) => Effect.Effect<CompetitionClass, CompetitionClassApiError | DbError, never>

    /**
     * Partially updates a competition class scoped to `domain`; fails when the row is missing
     * or belongs to another marathon.
     */
    readonly updateCompetitionClass: (
      input: UpdateCompetitionClassInput,
    ) => Effect.Effect<CompetitionClass, CompetitionClassApiError | DbError, never>

    /** Deletes a competition class by `id` after verifying it is owned by the marathon on `domain`. */
    readonly deleteCompetitionClass: (
      input: DeleteCompetitionClassInput,
    ) => Effect.Effect<CompetitionClass, CompetitionClassApiError | DbError, never>
  }
>()("@blikka/api/CompetitionClassesService") {}

const makeCompetitionClassesService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const competitionClassesRepository = yield* CompetitionClassesRepository

  const createCompetitionClass: CompetitionClassesService["Service"]["createCompetitionClass"] =
    Effect.fn("CompetitionClassesService.createCompetitionClass")(
      function* ({ data, domain }) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          )
        }

        return yield* competitionClassesRepository.createCompetitionClass({
          data: {
            ...data,
            marathonId: marathon.value.id,
            topicStartIndex: data.topicStartIndex ?? 0,
          },
        })
      },
    )

  const updateCompetitionClass: CompetitionClassesService["Service"]["updateCompetitionClass"] =
    Effect.fn("CompetitionClassesService.updateCompetitionClass")(
      function* ({ id, data, domain }) {
        const competitionClass =
          yield* competitionClassesRepository.getCompetitionClassById({
            id,
          })

        if (Option.isNone(competitionClass)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class not found with id ${id}`,
            }),
          )
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        })

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== competitionClass.value.marathonId
        ) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class does not belong to domain ${domain}`,
            }),
          )
        }

        return yield* competitionClassesRepository.updateCompetitionClass({
          id,
          data,
        })
      },
    )

  const deleteCompetitionClass: CompetitionClassesService["Service"]["deleteCompetitionClass"] =
    Effect.fn("CompetitionClassesService.deleteCompetitionClass")(
      function* ({ id, domain }) {
        const competitionClass =
          yield* competitionClassesRepository.getCompetitionClassById({
            id,
          })

        if (Option.isNone(competitionClass)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class not found with id ${id}`,
            }),
          )
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        })

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== competitionClass.value.marathonId
        ) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class does not belong to domain ${domain}`,
            }),
          )
        }

        return yield* competitionClassesRepository.deleteCompetitionClass({
          id,
        })
      },
    )

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

export const CompetitionClassesServiceLayer =
  CompetitionClassesServiceLayerNoDeps.pipe(Layer.provide(DbLayer))
