import "server-only"

import { Config, Context, Effect, Layer } from "effect"
import {
  DbLayer,
  type CompetitionClassesRepository,
  type ContactSheetsRepository,
  type DeviceGroupsRepository,
  type JuryRepository,
  type MarathonsRepository,
  type ParticipantsRepository,
  type RulesRepository,
  type SubmissionsRepository,
  type TopicsRepository,
  type UsersRepository,
  type ValidationsRepository,
  type VotingRepository,
  DbError,
} from "@blikka/db"
import type { S3ClientError, S3Service } from "@blikka/aws"
import { S3ServiceLayer } from "@blikka/aws"
import type {
  ContactSheetBuilder,
  ContactSheetError,
  SharpError,
  SharpImageService,
} from "@blikka/image-manipulation"
import {
  ContactSheetBuilderLayer,
  SharpImageServiceLayer,
} from "@blikka/image-manipulation"
import { JuryService, JuryServiceLayer } from "../jury/service"
import type {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalApiError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
} from "../errors"

type ApiError =
  | BadRequestError
  | ConflictError
  | ForbiddenError
  | InternalApiError
  | NotFoundError
  | PreconditionFailedError
  | UnauthorizedError
import {
  getSeedScenarioStatus,
  seedFinishedScenario,
} from "./finished-scenario"
import type { SeedingDomainContextInput } from "./contracts"

interface SeedScenarioStatusResult {
  environment: string
  mode: string
  isAdminForDomain: boolean
  staffCount: number
  blockers: string[]
  canRun: boolean
  preview: {
    participants: 30
    topics: 24
    competitionClasses: 2
    deviceGroups: 2
  }
}

type SeedScenarioStatusRequirements =
  | CompetitionClassesRepository
  | MarathonsRepository
  | ParticipantsRepository
  | TopicsRepository
  | ContactSheetsRepository
  | DeviceGroupsRepository
  | JuryRepository
  | UsersRepository
  | RulesRepository
  | ValidationsRepository
  | SubmissionsRepository
  | VotingRepository

type SeedFinishedScenarioResult =
  | {
      mode: "marathon"
      participantsCreated: number
      submissionsCreated: number
      participantVerificationsCreated: number
      juryInvitationsCreated: number
      juryRatingsCreated: number
      votingSessionsCreated: number
      votesCast: number
      contactSheetsCreated: number
      validationResultsCreated: number
    }
  | {
      mode: "by-camera"
      participantsCreated: number
      submissionsCreated: number
      participantVerificationsCreated: number
      juryInvitationsCreated: number
      juryRatingsCreated: number
      votingSessionsCreated: number
      votesCast: number
      contactSheetsCreated: number
      validationResultsCreated: number
    }

type SeedFinishedScenarioRequirements =
  | CompetitionClassesRepository
  | MarathonsRepository
  | ParticipantsRepository
  | TopicsRepository
  | S3Service
  | ContactSheetBuilder
  | ContactSheetsRepository
  | DeviceGroupsRepository
  | JuryRepository
  | UsersRepository
  | RulesRepository
  | ValidationsRepository
  | SubmissionsRepository
  | VotingRepository
  | SharpImageService
  | JuryService

export class SeedingService extends Context.Service<
  SeedingService,
  {
    /**
     * Summarizes whether demo seeding can run for `domain` (environment, blockers, staff count,
     * and a small preview of row counts).
     */
    readonly getStatus: (
      input: SeedingDomainContextInput,
    ) => Effect.Effect<
      SeedScenarioStatusResult,
      DbError | ApiError,
      SeedScenarioStatusRequirements
    >

    /**
     * Clears operational seedable data and repopulates a finished-event scenario for `domain`
     * when `getStatus` would allow it.
     */
    readonly seedFinishedScenarioForDomain: (
      input: SeedingDomainContextInput,
    ) => Effect.Effect<
      SeedFinishedScenarioResult,
      | DbError
      | S3ClientError
      | Config.ConfigError
      | ContactSheetError
      | ApiError
      | SharpError,
      SeedFinishedScenarioRequirements
    >
  }
>()("@blikka/api/SeedingService") {}

const makeSeedingService = Effect.gen(function* () {
  const getStatus: SeedingService["Service"]["getStatus"] = Effect.fn(
    "SeedingService.getStatus",
  )(function* ({ domain, isAdminForDomain }) {
    return yield* getSeedScenarioStatus({
      domain,
      isAdminForDomain,
    })
  })

  const seedFinishedScenarioForDomain: SeedingService["Service"]["seedFinishedScenarioForDomain"] =
    Effect.fn("SeedingService.seedFinishedScenarioForDomain")(
      function* ({ domain, isAdminForDomain }) {
        return yield* seedFinishedScenario({
          domain,
          isAdminForDomain,
        })
      },
    )

  return SeedingService.of({
    getStatus,
    seedFinishedScenarioForDomain,
  })
})

export const SeedingServiceLayerNoDeps = Layer.effect(
  SeedingService,
  makeSeedingService,
)

export const SeedingServiceLayer = SeedingServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DbLayer,
      S3ServiceLayer,
      SharpImageServiceLayer,
      ContactSheetBuilderLayer,
      JuryServiceLayer,
    ),
  ),
)
