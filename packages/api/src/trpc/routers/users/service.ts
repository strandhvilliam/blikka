import "server-only"

import { Effect, Layer, Option, ServiceMap } from "effect"
import { Database, normalizeEmail } from "@blikka/db"
import { RedisClient } from "@blikka/redis"
import { UsersApiError } from "./schemas"

function parseAccessId(accessId: string) {
  const decodedAccessId = accessId.includes("%")
    ? (() => {
        try {
          return decodeURIComponent(accessId)
        } catch {
          return accessId
        }
      })()
    : accessId

  if (decodedAccessId.startsWith("u:")) {
    return { kind: "active" as const, userId: decodedAccessId.slice(2) }
  }

  if (decodedAccessId.startsWith("p:")) {
    const pendingId = Number(decodedAccessId.slice(2))
    if (Number.isInteger(pendingId) && pendingId > 0) {
      return { kind: "pending" as const, pendingId }
    }
  }

  throw new UsersApiError({
    message: `Invalid access id: ${accessId}`,
  })
}

export class UsersApiService extends ServiceMap.Service<UsersApiService>()(
  "@blikka/api/UsersApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const redis = yield* RedisClient

      const clearPermissionsCache = (userId: string) =>
        redis.use((client) => client.del(`permissions:${userId}`))

      const getMarathonIdByDomain = Effect.fn("UsersApiService.getMarathonIdByDomain")(
        function* ({ domain }: { domain: string }) {
          const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })

          return yield* Option.match(marathon, {
            onSome: (m) => Effect.succeed(m.id),
            onNone: () =>
              Effect.fail(
                new UsersApiError({
                  message: `Marathon not found for domain ${domain}`,
                }),
              ),
          })
        },
      )

      const getStaffMembersByDomain = Effect.fn("UsersApiService.getStaffMembersByDomain")(
        function* ({ domain }: { domain: string }) {
          return yield* db.usersQueries.getStaffMembersByDomain({ domain })
        },
      )

      const getStaffAccessById = Effect.fn("UsersApiService.getStaffAccessById")(function* ({
        accessId,
        domain,
      }: {
        accessId: string
        domain: string
      }) {
        const parsed = parseAccessId(accessId)

        if (parsed.kind === "active") {
          const result = yield* db.usersQueries.getStaffMemberById({
            staffId: parsed.userId,
            domain,
          })

          return yield* Option.match(result, {
            onSome: (staff) => {
              const { id: relationId, ...rest } = staff

              return Effect.succeed({
                kind: "active" as const,
                id: accessId,
                relationId,
                ...rest,
              })
            },
            onNone: () =>
              Effect.fail(
                new UsersApiError({
                  message: `Staff member not found for id ${accessId} and domain ${domain}`,
                }),
              ),
          })
        }

        const pending = yield* db.usersQueries.getPendingUserMarathonById({
          pendingId: parsed.pendingId,
          domain,
        })

        return yield* Option.match(pending, {
          onSome: (staff) =>
            Effect.succeed({
              kind: "pending" as const,
              id: accessId,
              pendingId: staff.id,
              name: staff.name,
              email: staff.email,
              role: staff.role,
              createdAt: staff.createdAt,
              updatedAt: staff.updatedAt,
              marathonId: staff.marathonId,
              invitedByUserId: staff.invitedByUserId,
              status: "pending" as const,
            }),
          onNone: () =>
            Effect.fail(
              new UsersApiError({
                message: `Pending staff member not found for id ${accessId} and domain ${domain}`,
              }),
            ),
        })
      })

      const createStaffMember = Effect.fn("UsersApiService.createStaffMember")(function* ({
        domain,
        data,
      }: {
        domain: string
        data: { name: string; email: string; role: "staff" | "admin" }
      }) {
        const marathonId = yield* getMarathonIdByDomain({ domain })
        const trimmedEmail = data.email.trim()
        const emailNormalized = normalizeEmail(trimmedEmail)

        const existingUser = yield* db.usersQueries.getUserByNormalizedEmail({
          emailNormalized,
        })

        if (Option.isSome(existingUser)) {
          const relation = yield* db.usersQueries.upsertUserMarathonRelation({
            data: {
              userId: existingUser.value.id,
              marathonId,
              role: data.role,
            },
          })

          const pendingRelations = yield* db.usersQueries.getPendingUserMarathonsByEmailNormalized({
            emailNormalized,
          })

          for (const pendingRelation of pendingRelations) {
            if (pendingRelation.marathonId === marathonId) {
              yield* db.usersQueries.deletePendingUserMarathon({
                id: pendingRelation.id,
              })
            }
          }

          yield* clearPermissionsCache(existingUser.value.id)

          return {
            kind: "active" as const,
            id: `u:${existingUser.value.id}` as const,
            userId: existingUser.value.id,
            name: existingUser.value.name,
            email: existingUser.value.email,
            role: relation.role,
            createdAt: relation.createdAt,
            status: "active" as const,
          }
        }

        const pending = yield* db.usersQueries.upsertPendingUserMarathon({
          data: {
            marathonId,
            name: data.name,
            email: trimmedEmail,
            emailNormalized,
            role: data.role,
          },
        })

        return {
          kind: "pending" as const,
          id: `p:${pending.id}` as const,
          pendingId: pending.id,
          name: pending.name,
          email: pending.email,
          role: pending.role,
          createdAt: pending.createdAt,
          status: "pending" as const,
        }
      })

      const deleteStaffAccess = Effect.fn("UsersApiService.deleteStaffAccess")(function* ({
        domain,
        accessId,
      }: {
        domain: string
        accessId: string
      }) {
        const parsed = parseAccessId(accessId)

        if (parsed.kind === "active") {
          const marathonId = yield* getMarathonIdByDomain({ domain })
          const deleted = yield* db.usersQueries.deleteUserMarathonRelation({
            userId: parsed.userId,
            marathonId,
          })
          yield* clearPermissionsCache(parsed.userId)
          return deleted
        }

        const pending = yield* db.usersQueries.getPendingUserMarathonById({
          pendingId: parsed.pendingId,
          domain,
        })

        yield* Option.match(pending, {
          onSome: () => Effect.void,
          onNone: () =>
            Effect.fail(
              new UsersApiError({
                message: `Pending staff member not found for id ${accessId} and domain ${domain}`,
              }),
            ),
        })

        return yield* db.usersQueries.deletePendingUserMarathon({
          id: parsed.pendingId,
        })
      })

      const getVerificationsByStaffId = Effect.fn("UsersApiService.getVerificationsByStaffId")(
        function* ({
          staffId,
          domain,
          cursor,
          limit,
        }: {
          staffId: string
          domain: string
          cursor?: number
          limit?: number
        }) {
          return yield* db.validationsQueries.getParticipantVerificationsByStaffId({
            staffId,
            domain,
            cursor,
            limit,
          })
        },
      )

      const updateStaffAccess = Effect.fn("UsersApiService.updateStaffAccess")(function* ({
        accessId,
        domain,
        data,
      }: {
        accessId: string
        domain: string
        data: { name: string; email: string; role: "staff" | "admin" }
      }) {
        const parsed = parseAccessId(accessId)
        const trimmedEmail = data.email.trim()
        const emailNormalized = normalizeEmail(trimmedEmail)

        if (parsed.kind === "active") {
          const marathonId = yield* getMarathonIdByDomain({ domain })
          const staffMember = yield* db.usersQueries.getStaffMemberById({
            staffId: parsed.userId,
            domain,
          })

          yield* Option.match(staffMember, {
            onSome: () => Effect.void,
            onNone: () =>
              Effect.fail(
                new UsersApiError({
                  message: `Staff member not found for id ${accessId} and domain ${domain}`,
                }),
              ),
          })

          yield* db.usersQueries.updateUser({
            id: parsed.userId,
            data: {
              name: data.name,
              email: trimmedEmail,
              updatedAt: new Date().toISOString(),
            },
          })

          yield* db.usersQueries.updateUserMarathonRelation({
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

        const pending = yield* db.usersQueries.getPendingUserMarathonById({
          pendingId: parsed.pendingId,
          domain,
        })

        yield* Option.match(pending, {
          onSome: () => Effect.void,
          onNone: () =>
            Effect.fail(
              new UsersApiError({
                message: `Pending staff member not found for id ${accessId} and domain ${domain}`,
              }),
            ),
        })

        const existingUser = yield* db.usersQueries.getUserByNormalizedEmail({
          emailNormalized,
        })

        if (Option.isSome(existingUser)) {
          const marathonId = yield* getMarathonIdByDomain({ domain })

          yield* db.usersQueries.upsertUserMarathonRelation({
            data: {
              userId: existingUser.value.id,
              marathonId,
              role: data.role,
            },
          })

          yield* db.usersQueries.deletePendingUserMarathon({
            id: parsed.pendingId,
          })

          yield* clearPermissionsCache(existingUser.value.id)

          return {
            kind: "active" as const,
            id: `u:${existingUser.value.id}` as const,
            userId: existingUser.value.id,
            name: existingUser.value.name,
            email: existingUser.value.email,
            role: data.role,
            createdAt: new Date().toISOString(),
            status: "active" as const,
          }
        }

        yield* db.usersQueries.updatePendingUserMarathon({
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

      return {
        getStaffMembersByDomain,
        getStaffAccessById,
        createStaffMember,
        deleteStaffAccess,
        getVerificationsByStaffId,
        updateStaffAccess,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(Database.layer, RedisClient.layer)),
  )
}
