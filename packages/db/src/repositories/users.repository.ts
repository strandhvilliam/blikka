import { Effect, Layer, Option, Context } from 'effect'
import { and, desc, eq, sql } from 'drizzle-orm'
import { pendingUserMarathons, user, userMarathons } from '../schema'
import type {
  Marathon,
  NewPendingUserMarathonRelation,
  NewUser,
  NewUserMarathonRelation,
  Participant,
  ParticipantVerification,
  PendingUserMarathonRelation,
  User,
  UserMarathonRelation,
} from '../types'
import { DrizzleClient } from '../drizzle-client'
import { DbError, normalizeEmail } from '../utils'

type ActiveStaffAccess = {
  kind: 'active'
  id: `u:${string}`
  userId: string
  name: string
  email: string
  role: string
  createdAt: string
  status: 'active'
}

type PendingStaffAccess = {
  kind: 'pending'
  id: `p:${number}`
  pendingId: number
  name: string
  email: string
  role: string
  createdAt: string
  status: 'pending'
}

interface UserWithMarathons extends User {
  userMarathons: Array<UserMarathonRelation & { marathon: Marathon }>
}

interface MarathonWithRole extends Marathon {
  role: string
}

interface UserWithUserMarathons extends User {
  userMarathons: UserMarathonRelation[]
}

interface PendingUserMarathonWithMarathon extends PendingUserMarathonRelation {
  marathon: Marathon
}

type ParticipantVerificationWithParticipant = ParticipantVerification & {
  participant: Participant
}

/** User payload returned with `getStaffMemberById` (relations scoped by query). */
type StaffMemberUserDetails = User & {
  participantVerifications: ParticipantVerificationWithParticipant[]
  userMarathons: UserMarathonRelation[]
}

type StaffMemberByIdRow = UserMarathonRelation & {
  user: StaffMemberUserDetails
}

export class UsersRepository extends Context.Service<
  UsersRepository,
  {
    /** Permission rows for a user across accessible marathons. */
    readonly getUserPermissions: (params: { userId: string }) => Effect.Effect<
      {
        userId: string
        relationId: number
        marathonId: number
        domain: string
        role: string
      }[],
      DbError
    >
    /** User row by id, or none if missing. */
    readonly getUserById: (params: { id: string }) => Effect.Effect<Option.Option<User>, DbError>
    /** User with marathon relations by user id, or none if missing. */
    readonly getUserWithMarathons: (params: {
      userId: string
    }) => Effect.Effect<Option.Option<UserWithMarathons>, DbError>
    /** Marathons related to a user by id. */
    readonly getMarathonsByUserId: (params: {
      userId: string
    }) => Effect.Effect<MarathonWithRole[], DbError>
    /** User with marathon relations by email, or none if missing. */
    readonly getUserByEmailWithMarathons: (params: {
      email: string
    }) => Effect.Effect<Option.Option<UserWithUserMarathons>, DbError>
    /** User row by normalized email, or none if missing. */
    readonly getUserByNormalizedEmail: (params: {
      emailNormalized: string
    }) => Effect.Effect<Option.Option<User>, DbError>
    /** Pending marathon invitations by normalized email. */
    readonly getPendingUserMarathonsByEmailNormalized: (params: {
      emailNormalized: string
    }) => Effect.Effect<PendingUserMarathonRelation[], DbError>
    /** Pending marathon invitations for a marathon domain. */
    readonly getPendingUserMarathonsByDomain: (params: {
      domain: string
    }) => Effect.Effect<PendingUserMarathonRelation[], DbError>
    /** Pending marathon invitation by id scoped to a domain, or none if missing. */
    readonly getPendingUserMarathonById: (params: {
      pendingId: number
      domain: string
    }) => Effect.Effect<Option.Option<PendingUserMarathonWithMarathon>, DbError>
    /** Active and pending staff members for a marathon domain. */
    readonly getStaffMembersByDomain: (params: {
      domain: string
    }) => Effect.Effect<(ActiveStaffAccess | PendingStaffAccess)[], DbError>
    /** Staff member by id scoped to a domain, or none if missing. */
    readonly getStaffMemberById: (params: {
      staffId: string
      domain: string
    }) => Effect.Effect<Option.Option<StaffMemberByIdRow>, DbError>
    /** Insert a new user row. */
    readonly createUser: (params: { data: NewUser }) => Effect.Effect<User, DbError>
    /** Patch fields on a user identified by id. */
    readonly updateUser: (params: {
      id: string
      data: Partial<NewUser>
    }) => Effect.Effect<User, DbError>
    /** Delete a user by id. */
    readonly deleteUser: (params: { id: string }) => Effect.Effect<User, DbError>
    /** Insert a user-marathon relation row. */
    readonly createUserMarathonRelation: (params: {
      data: NewUserMarathonRelation
    }) => Effect.Effect<UserMarathonRelation, DbError>
    /** Upsert a user-marathon relation by user and marathon. */
    readonly upsertUserMarathonRelation: (params: {
      data: NewUserMarathonRelation
    }) => Effect.Effect<UserMarathonRelation, DbError>
    /** Patch a user-marathon relation by user and marathon. */
    readonly updateUserMarathonRelation: (params: {
      userId: string
      marathonId: number
      data: Partial<Pick<NewUserMarathonRelation, 'role'>>
    }) => Effect.Effect<UserMarathonRelation, DbError>
    /** Delete a user-marathon relation by user and marathon. */
    readonly deleteUserMarathonRelation: (params: {
      userId: string
      marathonId: number
    }) => Effect.Effect<UserMarathonRelation, DbError>
    /** Upsert a pending user-marathon invitation. */
    readonly upsertPendingUserMarathon: (params: {
      data: NewPendingUserMarathonRelation
    }) => Effect.Effect<PendingUserMarathonRelation, DbError>
    /** Patch a pending user-marathon invitation by id. */
    readonly updatePendingUserMarathon: (params: {
      id: number
      data: Partial<NewPendingUserMarathonRelation>
    }) => Effect.Effect<PendingUserMarathonRelation, DbError>
    /** Delete a pending user-marathon invitation by id. */
    readonly deletePendingUserMarathon: (params: {
      id: number
    }) => Effect.Effect<PendingUserMarathonRelation, DbError>
    /** Claim pending invitations for a user by email. */
    readonly claimPendingUserMarathonsForUser: (params: {
      userId: string
      email: string
    }) => Effect.Effect<PendingUserMarathonRelation[], DbError>
  }
>()('@blikka/db/users-repository') {}

const makeUsersRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getUserPermissions: UsersRepository['Service']['getUserPermissions'] = Effect.fn(
    'UsersRepository.getUserPermissions',
  )(function* ({ userId }) {
    const rel = yield* use((db) =>
      db.query.userMarathons.findMany({
        where: (table, operators) => operators.eq(table.userId, userId),
        with: {
          marathon: true,
        },
      }),
    )

    return rel.map((row) => ({
      userId: row.userId,
      relationId: row.id,
      marathonId: row.marathonId,
      domain: row.marathon.domain,
      role: row.role,
    }))
  })

  const getUserById: UsersRepository['Service']['getUserById'] = Effect.fn(
    'UsersRepository.getUserById',
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.user.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )

    return Option.fromNullishOr(result)
  })

  const getUserWithMarathons: UsersRepository['Service']['getUserWithMarathons'] = Effect.fn(
    'UsersRepository.getUserWithMarathons',
  )(function* ({ userId }) {
    const result = yield* use((db) =>
      db.query.user.findFirst({
        where: (table, operators) => operators.eq(table.id, userId),
        with: {
          userMarathons: {
            with: {
              marathon: true,
            },
          },
        },
      }),
    )

    return Option.fromNullishOr(result)
  })

  const getMarathonsByUserId: UsersRepository['Service']['getMarathonsByUserId'] = Effect.fn(
    'UsersRepository.getMarathonsByUserId',
  )(function* ({ userId }) {
    const result = yield* use((db) =>
      db.query.userMarathons.findMany({
        where: (table, operators) => operators.eq(table.userId, userId),
        with: {
          marathon: true,
        },
      }),
    )

    return result.map((userMarathon) => ({
      ...userMarathon.marathon,
      role: userMarathon.role,
    }))
  })

  const getUserByEmailWithMarathons: UsersRepository['Service']['getUserByEmailWithMarathons'] =
    Effect.fn('UsersRepository.getUserByEmailWithMarathons')(function* ({ email }) {
      const normalizedEmail = normalizeEmail(email)
      const result = yield* use((db) =>
        db.query.user.findFirst({
          where: sql`lower(${user.email}) = ${normalizedEmail}`,
          with: {
            userMarathons: true,
          },
        }),
      )

      return Option.fromNullishOr(result)
    })

  const getUserByNormalizedEmail: UsersRepository['Service']['getUserByNormalizedEmail'] =
    Effect.fn('UsersRepository.getUserByNormalizedEmail')(function* ({ emailNormalized }) {
      const result = yield* use((db) =>
        db.query.user.findFirst({
          where: sql`lower(${user.email}) = ${emailNormalized}`,
        }),
      )

      return Option.fromNullishOr(result)
    })

  const getPendingUserMarathonsByEmailNormalized: UsersRepository['Service']['getPendingUserMarathonsByEmailNormalized'] =
    Effect.fn('UsersRepository.getPendingUserMarathonsByEmailNormalized')(function* ({
      emailNormalized,
    }) {
      return yield* use((db) =>
        db.query.pendingUserMarathons.findMany({
          where: (table, operators) => operators.eq(table.emailNormalized, emailNormalized),
          orderBy: (table) => [desc(table.createdAt)],
        }),
      )
    })

  const getPendingUserMarathonsByDomain: UsersRepository['Service']['getPendingUserMarathonsByDomain'] =
    Effect.fn('UsersRepository.getPendingUserMarathonsByDomain')(function* ({ domain }) {
      const result = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            pendingUserMarathons: {
              orderBy: (table) => [desc(table.createdAt)],
            },
          },
        }),
      )

      return result?.pendingUserMarathons ?? []
    })

  const getPendingUserMarathonById: UsersRepository['Service']['getPendingUserMarathonById'] =
    Effect.fn('UsersRepository.getPendingUserMarathonById')(function* ({ pendingId, domain }) {
      const result = yield* use((db) =>
        db.query.pendingUserMarathons.findFirst({
          where: (table, operators) => operators.eq(table.id, pendingId),
          with: {
            marathon: true,
          },
        }),
      )

      if (!result || result.marathon.domain !== domain) {
        return Option.none()
      }

      return Option.some(result)
    })

  const getStaffMembersByDomain: UsersRepository['Service']['getStaffMembersByDomain'] = Effect.fn(
    'UsersRepository.getStaffMembersByDomain',
  )(function* ({ domain }) {
    const result = yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.domain, domain),
        with: {
          userMarathons: {
            orderBy: (table) => [desc(table.createdAt)],
            with: {
              user: true,
            },
          },
          pendingUserMarathons: {
            orderBy: (table) => [desc(table.createdAt)],
          },
        },
      }),
    )

    if (!result) {
      return []
    }

    const activeStaff: ActiveStaffAccess[] = result.userMarathons.map((staff) => ({
      kind: 'active',
      id: `u:${staff.userId}`,
      userId: staff.userId,
      name: staff.user.name,
      email: staff.user.email,
      role: staff.role,
      createdAt: staff.createdAt,
      status: 'active',
    }))

    const pendingStaff: PendingStaffAccess[] = result.pendingUserMarathons.map((staff) => ({
      kind: 'pending',
      id: `p:${staff.id}`,
      pendingId: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      createdAt: staff.createdAt,
      status: 'pending',
    }))

    return [...activeStaff, ...pendingStaff]
  })

  const getStaffMemberById: UsersRepository['Service']['getStaffMemberById'] = Effect.fn(
    'UsersRepository.getStaffMemberById',
  )(function* ({ staffId, domain }) {
    const marathon = yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.domain, domain),
        columns: { id: true },
      }),
    )

    if (!marathon) {
      return Option.none()
    }

    const result = yield* use((db) =>
      db.query.user.findFirst({
        where: (table, operators) => operators.eq(table.id, staffId),
        with: {
          userMarathons: {
            where: (table, operators) => operators.eq(table.marathonId, marathon.id),
          },
          participantVerifications: {
            with: {
              participant: true,
            },
          },
        },
      }),
    )

    if (!result?.userMarathons[0]) {
      return Option.none()
    }

    const filteredParticipantVerifications = result.participantVerifications.filter(
      (pv) => pv.participant.marathonId === marathon.id,
    )

    return Option.some({
      ...result.userMarathons[0],
      user: {
        ...result,
        participantVerifications: filteredParticipantVerifications,
      },
    })
  })

  const createUser: UsersRepository['Service']['createUser'] = Effect.fn(
    'UsersRepository.createUser',
  )(function* ({ data }: { data: NewUser }) {
    const [result] = yield* use((db) => db.insert(user).values(data).returning())

    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to create user',
        }),
      )
    }

    return result
  })

  const updateUser: UsersRepository['Service']['updateUser'] = Effect.fn(
    'UsersRepository.updateUser',
  )(function* ({ id, data }: { id: string; data: Partial<NewUser> }) {
    const [result] = yield* use((db) =>
      db.update(user).set(data).where(eq(user.id, id)).returning(),
    )

    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to update user',
        }),
      )
    }

    return result
  })

  const deleteUser: UsersRepository['Service']['deleteUser'] = Effect.fn(
    'UsersRepository.deleteUser',
  )(function* ({ id }: { id: string }) {
    const [result] = yield* use((db) => db.delete(user).where(eq(user.id, id)).returning())

    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to delete user',
        }),
      )
    }

    return result
  })

  const createUserMarathonRelation: UsersRepository['Service']['createUserMarathonRelation'] =
    Effect.fn('UsersRepository.createUserMarathonRelation')(function* ({ data }) {
      const [result] = yield* use((db) => db.insert(userMarathons).values(data).returning())

      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to create user marathon relation',
          }),
        )
      }

      return result
    })

  const upsertUserMarathonRelation: UsersRepository['Service']['upsertUserMarathonRelation'] =
    Effect.fn('UsersRepository.upsertUserMarathonRelation')(function* ({ data }) {
      const result = yield* use((db) =>
        db
          .insert(userMarathons)
          .values(data)
          .onConflictDoUpdate({
            target: [userMarathons.marathonId, userMarathons.userId],
            set: {
              role: data.role ?? 'staff',
            },
          })
          .returning(),
      )

      return result[0]!
    })

  const updateUserMarathonRelation: UsersRepository['Service']['updateUserMarathonRelation'] =
    Effect.fn('UsersRepository.updateUserMarathonRelation')(function* ({
      userId,
      marathonId,
      data,
    }) {
      const [result] = yield* use((db) =>
        db
          .update(userMarathons)
          .set(data)
          .where(and(eq(userMarathons.userId, userId), eq(userMarathons.marathonId, marathonId)))
          .returning(),
      )

      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to update user marathon relation',
          }),
        )
      }

      return result
    })

  const deleteUserMarathonRelation: UsersRepository['Service']['deleteUserMarathonRelation'] =
    Effect.fn('UsersRepository.deleteUserMarathonRelation')(function* ({ userId, marathonId }) {
      const [result] = yield* use((db) =>
        db
          .delete(userMarathons)
          .where(and(eq(userMarathons.userId, userId), eq(userMarathons.marathonId, marathonId)))
          .returning(),
      )

      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to delete user marathon relation',
          }),
        )
      }

      return result
    })

  const upsertPendingUserMarathon: UsersRepository['Service']['upsertPendingUserMarathon'] =
    Effect.fn('UsersRepository.upsertPendingUserMarathon')(function* ({ data }) {
      const normalizedEmail = normalizeEmail(data.email)
      const result = yield* use((db) =>
        db
          .insert(pendingUserMarathons)
          .values({
            ...data,
            email: data.email.trim(),
            emailNormalized: normalizedEmail,
          })
          .onConflictDoUpdate({
            target: [pendingUserMarathons.marathonId, pendingUserMarathons.emailNormalized],
            set: {
              email: data.email.trim(),
              emailNormalized: normalizedEmail,
              name: data.name,
              role: data.role ?? 'staff',
              invitedByUserId: data.invitedByUserId ?? null,
              updatedAt: new Date().toISOString(),
            },
          })
          .returning(),
      )

      return result[0]!
    })

  const updatePendingUserMarathon: UsersRepository['Service']['updatePendingUserMarathon'] =
    Effect.fn('UsersRepository.updatePendingUserMarathon')(function* ({ id, data }) {
      const nextEmail = data.email ? data.email.trim() : undefined
      const [result] = yield* use((db) =>
        db
          .update(pendingUserMarathons)
          .set({
            ...data,
            email: nextEmail,
            emailNormalized: nextEmail ? normalizeEmail(nextEmail) : data.emailNormalized,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(pendingUserMarathons.id, id))
          .returning(),
      )

      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to update pending user marathon relation',
          }),
        )
      }

      return result
    })

  const deletePendingUserMarathon: UsersRepository['Service']['deletePendingUserMarathon'] =
    Effect.fn('UsersRepository.deletePendingUserMarathon')(function* ({ id }) {
      const [result] = yield* use((db) =>
        db.delete(pendingUserMarathons).where(eq(pendingUserMarathons.id, id)).returning(),
      )

      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to delete pending user marathon relation',
          }),
        )
      }

      return result
    })

  const claimPendingUserMarathonsForUser: UsersRepository['Service']['claimPendingUserMarathonsForUser'] =
    Effect.fn('UsersRepository.claimPendingUserMarathonsForUser')(function* ({ userId, email }) {
      const emailNormalized = normalizeEmail(email)
      const currentUser = yield* getUserById({ id: userId })
      const pendingRelations = yield* use((db) =>
        db.query.pendingUserMarathons.findMany({
          where: (table, operators) => operators.eq(table.emailNormalized, emailNormalized),
        }),
      )

      if (!pendingRelations.length) {
        return []
      }

      const claimName = pendingRelations.find((relation) => relation.name.trim().length > 0)?.name
      if (claimName && Option.isSome(currentUser) && currentUser.value.name.trim().length === 0) {
        yield* updateUser({
          id: userId,
          data: {
            name: claimName,
            updatedAt: new Date().toISOString(),
          },
        })
      }

      const claimedRelations: typeof pendingRelations = []

      for (const pendingRelation of pendingRelations) {
        yield* use((db) =>
          db
            .insert(userMarathons)
            .values({
              userId,
              marathonId: pendingRelation.marathonId,
              role: pendingRelation.role,
            })
            .onConflictDoUpdate({
              target: [userMarathons.marathonId, userMarathons.userId],
              set: {
                role: pendingRelation.role,
              },
            }),
        )

        yield* use((db) =>
          db.delete(pendingUserMarathons).where(eq(pendingUserMarathons.id, pendingRelation.id)),
        )

        claimedRelations.push(pendingRelation)
      }

      return claimedRelations
    })

  return UsersRepository.of({
    getUserPermissions,
    getUserById,
    getUserWithMarathons,
    getMarathonsByUserId,
    getUserByEmailWithMarathons,
    getUserByNormalizedEmail,
    getPendingUserMarathonsByEmailNormalized,
    getPendingUserMarathonsByDomain,
    getPendingUserMarathonById,
    getStaffMembersByDomain,
    getStaffMemberById,
    createUser,
    updateUser,
    deleteUser,
    createUserMarathonRelation,
    upsertUserMarathonRelation,
    updateUserMarathonRelation,
    deleteUserMarathonRelation,
    upsertPendingUserMarathon,
    updatePendingUserMarathon,
    deletePendingUserMarathon,
    claimPendingUserMarathonsForUser,
  })
})

export const UsersRepositoryLayerNoDeps = Layer.effect(UsersRepository, makeUsersRepository)

export const UsersRepositoryLayer = UsersRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
