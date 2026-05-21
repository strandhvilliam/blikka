
import { Effect, Layer, Option, Context } from 'effect'
import {
  DbLayer,
  MarathonsRepository,
  ValidationsRepository,
  UsersRepository,
  normalizeEmail,
  DbError,
  type CompetitionClass,
  type DeviceGroup,
  type Participant,
  type Submission,
  type UserMarathonRelation,
  type ValidationResult,
} from '@blikka/db'
import { RedisClient, RedisClientLayer, type RedisError } from '@blikka/redis'
import { BadRequestError, NotFoundError, failNotFoundIfNone } from '../errors'
import { parseAccessId } from './parse-access-id'
import type {
  CreateStaffMemberInput,
  DeleteUserMarathonRelationInput,
  GetStaffMemberByIdInput,
  GetStaffMembersByDomainInput,
  GetVerificationsByStaffIdInput,
  UpdateStaffMemberInput,
} from './contracts'

/** Row returned for staff listing on a marathon domain (`active` vs `pending` invitation). */
type StaffMemberListItem =
  | {
      kind: 'active'
      id: `u:${string}`
      userId: string
      name: string
      email: string
      role: string
      createdAt: string
      status: 'active'
    }
  | {
      kind: 'pending'
      id: `p:${number}`
      pendingId: number
      name: string
      email: string
      role: string
      createdAt: string
      status: 'pending'
    }

interface StaffParticipantVerificationRow {
  id: number
  createdAt: string
  updatedAt: string | null
  participantId: number
  notes: string | null
  staffId: string
  participant: Participant
}

interface StaffUserWithRelations {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  participantVerifications: StaffParticipantVerificationRow[]
  userMarathons: UserMarathonRelation[]
}

/** Resolved staff access for an existing user linked to the marathon. */
interface ActiveStaffAccessDetail {
  createdAt: string
  marathonId: number
  role: string
  userId: string
  user: StaffUserWithRelations
  kind: 'active'
  id: string
  relationId: number
}

/** Pending invitation row returned as staff access. */
interface PendingStaffAccessDetail {
  kind: 'pending'
  id: string
  pendingId: number
  name: string
  email: string
  role: string
  createdAt: string
  updatedAt: string | null
  marathonId: number
  invitedByUserId: string | null
  status: 'pending'
}

type StaffAccessByIdResult = ActiveStaffAccessDetail | PendingStaffAccessDetail

type CreateStaffMemberResult =
  | {
      kind: 'active'
      id: `u:${string}`
      userId: string
      name: string
      email: string
      role: string
      createdAt: string
      status: 'active'
      pendingId?: undefined
    }
  | {
      kind: 'pending'
      id: `p:${number}`
      pendingId: number
      name: string
      email: string
      role: string
      createdAt: string
      status: 'pending'
      userId?: undefined
    }

type DeleteStaffAccessResult =
  | {
      id: number
      createdAt: string
      updatedAt: string | null
      name: string
      marathonId: number
      email: string
      emailNormalized: string
      role: string
      invitedByUserId: string | null
    }
  | {
      id: number
      createdAt: string
      marathonId: number
      role: string
      userId: string
    }

interface VerificationParticipantWithRelations {
  domain: string
  id: number
  createdAt: string
  updatedAt: string | null
  marathonId: number
  reference: string
  email: string | null
  status: string
  competitionClassId: number | null
  deviceGroupId: number | null
  participantMode: string
  firstname: string
  lastname: string
  phoneHash: string | null
  phoneEncrypted: string | null
  marathon: undefined
  submissions: Submission[]
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  validationResults: ValidationResult[]
}

interface VerificationsByStaffVerificationRow {
  id: number
  createdAt: string
  updatedAt: string | null
  participantId: number
  notes: string | null
  staffId: string
  participant: VerificationParticipantWithRelations
}

interface VerificationsByStaffPage {
  items: VerificationsByStaffVerificationRow[]
  nextCursor: number | undefined
}

/** Active staff summary returned when a pending invite is promoted to an existing user. */
interface PromotedActiveStaffSummary {
  kind: 'active'
  id: `u:${string}`
  userId: string
  name: string
  email: string
  role: 'staff' | 'admin'
  createdAt: string
  status: 'active'
}

type UpdateStaffAccessResult = StaffAccessByIdResult | PromotedActiveStaffSummary

export class UsersService extends Context.Service<
  UsersService,
  {
    /**
     * Lists staff for a marathon `domain`: active relations and pending invitations,
     * each tagged with `kind` and an encoded `id` (`u:` or `p:`).
     */
    readonly getStaffMembersByDomain: (
      input: GetStaffMembersByDomainInput,
    ) => Effect.Effect<StaffMemberListItem[], DbError, never>

    /**
     * Resolves a staff `accessId` (`u:` user or `p:` pending) within `domain` to a full
     * active staff payload (user + relations) or a pending row.
     */
    readonly getStaffAccessById: (
      input: GetStaffMemberByIdInput,
    ) => Effect.Effect<StaffAccessByIdResult, DbError | NotFoundError | BadRequestError, never>

    /**
     * Adds staff: links an existing user by normalized email or creates/updates a pending invite;
     * clears permission cache when an active user is linked.
     */
    readonly createStaffMember: (
      input: CreateStaffMemberInput,
    ) => Effect.Effect<CreateStaffMemberResult, DbError | NotFoundError | RedisError, never>

    /**
     * Removes staff access: drops the user–marathon relation for `u:` ids or deletes the pending row for `p:`;
     * clears permission cache for active users.
     */
    readonly deleteStaffAccess: (
      input: DeleteUserMarathonRelationInput,
    ) => Effect.Effect<
      DeleteStaffAccessResult,
      DbError | NotFoundError | BadRequestError | RedisError,
      never
    >

    /**
     * Cursor-paged participant verifications attributed to a staff member (`staffId`) on `domain`.
     */
    readonly getVerificationsByStaffId: (
      input: GetVerificationsByStaffIdInput,
    ) => Effect.Effect<VerificationsByStaffPage, DbError, never>

    /**
     * Updates staff profile (name, email, role) for active or pending access; may promote pending to active
     * when the email matches an existing user.
     */
    readonly updateStaffAccess: (
      input: UpdateStaffMemberInput,
    ) => Effect.Effect<
      UpdateStaffAccessResult,
      DbError | NotFoundError | BadRequestError | RedisError,
      never
    >
  }
>()('@blikka/api/UsersService') {}

const makeUsersService = Effect.gen(function* () {
  const usersRepository = yield* UsersRepository
  const validationsRepository = yield* ValidationsRepository
  const marathonsRepository = yield* MarathonsRepository
  const redis = yield* RedisClient

  const clearPermissionsCache = (userId: string) =>
    redis.use((client) => client.del(`permissions:${userId}`))

  const getMarathonIdByDomain = Effect.fn('UsersService.getMarathonIdByDomain')(function* ({
    domain,
  }: {
    domain: string
  }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))
    return marathon.id
  })

  const getStaffMembersByDomain: UsersService['Service']['getStaffMembersByDomain'] = Effect.fn(
    'UsersService.getStaffMembersByDomain',
  )(function* ({ domain }) {
    return yield* usersRepository.getStaffMembersByDomain({ domain })
  })

  const getStaffAccessById: UsersService['Service']['getStaffAccessById'] = Effect.fn(
    'UsersService.getStaffAccessById',
  )(function* ({ accessId, domain }) {
    const parsed = yield* parseAccessId(accessId)

    if (parsed.kind === 'active') {
      const staff = yield* usersRepository
        .getStaffMemberById({ staffId: parsed.userId, domain })
        .pipe(failNotFoundIfNone('StaffMember', { id: accessId, domain }))
      const { id: relationId, ...rest } = staff

      return {
        kind: 'active' as const,
        id: accessId,
        relationId,
        ...rest,
      }
    }

    const staff = yield* usersRepository
      .getPendingUserMarathonById({
        pendingId: parsed.pendingId,
        domain,
      })
      .pipe(failNotFoundIfNone('PendingStaffMember', { id: accessId, domain }))

    return {
      kind: 'pending' as const,
      id: accessId,
      pendingId: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
      marathonId: staff.marathonId,
      invitedByUserId: staff.invitedByUserId,
      status: 'pending' as const,
    }
  })

  const createStaffMember: UsersService['Service']['createStaffMember'] = Effect.fn(
    'UsersService.createStaffMember',
  )(function* ({ domain, data }) {
    const marathonId = yield* getMarathonIdByDomain({ domain })
    const trimmedEmail = data.email.trim()
    const emailNormalized = normalizeEmail(trimmedEmail)

    const existingUser = yield* usersRepository.getUserByNormalizedEmail({
      emailNormalized,
    })

    if (Option.isSome(existingUser)) {
      const relation = yield* usersRepository.upsertUserMarathonRelation({
        data: {
          userId: existingUser.value.id,
          marathonId,
          role: data.role,
        },
      })

      const pendingRelations = yield* usersRepository.getPendingUserMarathonsByEmailNormalized({
        emailNormalized,
      })

      for (const pendingRelation of pendingRelations) {
        if (pendingRelation.marathonId === marathonId) {
          yield* usersRepository.deletePendingUserMarathon({
            id: pendingRelation.id,
          })
        }
      }

      yield* clearPermissionsCache(existingUser.value.id)

      return {
        kind: 'active' as const,
        id: `u:${existingUser.value.id}` as const,
        userId: existingUser.value.id,
        name: existingUser.value.name,
        email: existingUser.value.email,
        role: relation.role,
        createdAt: relation.createdAt,
        status: 'active' as const,
      }
    }

    const pending = yield* usersRepository.upsertPendingUserMarathon({
      data: {
        marathonId,
        name: data.name,
        email: trimmedEmail,
        emailNormalized,
        role: data.role,
      },
    })

    return {
      kind: 'pending' as const,
      id: `p:${pending.id}` as const,
      pendingId: pending.id,
      name: pending.name,
      email: pending.email,
      role: pending.role,
      createdAt: pending.createdAt,
      status: 'pending' as const,
    }
  })

  const deleteStaffAccess: UsersService['Service']['deleteStaffAccess'] = Effect.fn(
    'UsersService.deleteStaffAccess',
  )(function* ({ domain, accessId }) {
    const parsed = yield* parseAccessId(accessId)

    if (parsed.kind === 'active') {
      const marathonId = yield* getMarathonIdByDomain({ domain })
      const deleted = yield* usersRepository.deleteUserMarathonRelation({
        userId: parsed.userId,
        marathonId,
      })
      yield* clearPermissionsCache(parsed.userId)
      return deleted
    }

    yield* usersRepository
      .getPendingUserMarathonById({
        pendingId: parsed.pendingId,
        domain,
      })
      .pipe(failNotFoundIfNone('PendingStaffMember', { id: accessId, domain }))

    return yield* usersRepository.deletePendingUserMarathon({
      id: parsed.pendingId,
    })
  })

  const getVerificationsByStaffId: UsersService['Service']['getVerificationsByStaffId'] = Effect.fn(
    'UsersService.getVerificationsByStaffId',
  )(function* ({ staffId, domain, cursor, limit }) {
    return yield* validationsRepository.getParticipantVerificationsByStaffId({
      staffId,
      domain,
      cursor,
      limit,
    })
  })

  const updateStaffAccess: UsersService['Service']['updateStaffAccess'] = Effect.fn(
    'UsersService.updateStaffAccess',
  )(function* ({ accessId, domain, data }) {
    const parsed = yield* parseAccessId(accessId)
    const trimmedEmail = data.email.trim()
    const emailNormalized = normalizeEmail(trimmedEmail)

    if (parsed.kind === 'active') {
      const marathonId = yield* getMarathonIdByDomain({ domain })
      yield* usersRepository
        .getStaffMemberById({ staffId: parsed.userId, domain })
        .pipe(failNotFoundIfNone('StaffMember', { id: accessId, domain }))

      yield* usersRepository.updateUser({
        id: parsed.userId,
        data: {
          name: data.name,
          email: trimmedEmail,
          updatedAt: new Date().toISOString(),
        },
      })

      yield* usersRepository.updateUserMarathonRelation({
        userId: parsed.userId,
        marathonId,
        data: {
          role: data.role,
        },
      })

      yield* clearPermissionsCache(parsed.userId)

      return yield* getStaffAccessById({
        accessId,
        domain,
      })
    }

    yield* usersRepository
      .getPendingUserMarathonById({
        pendingId: parsed.pendingId,
        domain,
      })
      .pipe(failNotFoundIfNone('PendingStaffMember', { id: accessId, domain }))

    const existingUser = yield* usersRepository.getUserByNormalizedEmail({
      emailNormalized,
    })

    if (Option.isSome(existingUser)) {
      const marathonId = yield* getMarathonIdByDomain({ domain })

      yield* usersRepository.upsertUserMarathonRelation({
        data: {
          userId: existingUser.value.id,
          marathonId,
          role: data.role,
        },
      })

      yield* usersRepository.deletePendingUserMarathon({
        id: parsed.pendingId,
      })

      yield* clearPermissionsCache(existingUser.value.id)

      return {
        kind: 'active' as const,
        id: `u:${existingUser.value.id}` as const,
        userId: existingUser.value.id,
        name: existingUser.value.name,
        email: existingUser.value.email,
        role: data.role,
        createdAt: new Date().toISOString(),
        status: 'active' as const,
      }
    }

    yield* usersRepository.updatePendingUserMarathon({
      id: parsed.pendingId,
      data: {
        name: data.name,
        email: trimmedEmail,
        emailNormalized,
        role: data.role,
      },
    })

    return yield* getStaffAccessById({
      accessId,
      domain,
    })
  })

  return UsersService.of({
    getStaffMembersByDomain,
    getStaffAccessById,
    createStaffMember,
    deleteStaffAccess,
    getVerificationsByStaffId,
    updateStaffAccess,
  })
})

export const UsersServiceLayerNoDeps = Layer.effect(UsersService, makeUsersService)

export const UsersServiceLayer = UsersServiceLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, RedisClientLayer)),
)
