import "server-only"

import { Effect, Option } from "effect"
import { Database } from "@blikka/db"
import { UsersApiError } from "./schemas"
import crypto from "crypto"

export class UsersApiService extends Effect.Service<UsersApiService>()(
  "@blikka/api-v2/UsersApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database

      const getStaffMembersByDomain = Effect.fn("UsersApiService.getStaffMembersByDomain")(
        function* ({ domain }: { domain: string }) {
          return yield* db.usersQueries.getStaffMembersByDomain({ domain })
        }
      )

      const getStaffMemberById = Effect.fn("UsersApiService.getStaffMemberById")(function* ({
        staffId,
        domain,
      }: {
        staffId: string
        domain: string
      }) {
        const result = yield* db.usersQueries.getStaffMemberById({ staffId, domain })
        return yield* Option.match(result, {
          onSome: (staff) => Effect.succeed(staff),
          onNone: () =>
            Effect.fail(
              new UsersApiError({
                message: `Staff member not found for id ${staffId} and domain ${domain}`,
              })
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
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })
        const marathonId = yield* Option.match(marathon, {
          onSome: (m) => Effect.succeed(m.id),
          onNone: () =>
            Effect.fail(
              new UsersApiError({
                message: `Marathon not found for domain ${domain}`,
              })
            ),
        })

        const existingUser = yield* db.usersQueries.getUserByEmailWithMarathons({
          email: data.email,
        })

        let userId: string

        if (Option.isNone(existingUser)) {
          const newUser = yield* db.usersQueries.createUser({
            data: {
              id: crypto.randomUUID(),
              email: data.email,
              name: data.name,
              emailVerified: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          })
          userId = newUser.id
        } else {
          userId = existingUser.value.id
        }

        yield* db.usersQueries.createUserMarathonRelation({
          data: {
            userId,
            marathonId,
            role: data.role,
          },
        })

        const user = yield* db.usersQueries.getUserById({ id: userId })
        return yield* Option.match(user, {
          onSome: (u) => Effect.succeed(u),
          onNone: () =>
            Effect.fail(
              new UsersApiError({
                message: `Failed to retrieve created user with id ${userId}`,
              })
            ),
        })
      })

      const deleteUserMarathonRelation = Effect.fn("UsersApiService.deleteUserMarathonRelation")(
        function* ({ domain, userId }: { domain: string; userId: string }) {
          const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })
          const marathonId = yield* Option.match(marathon, {
            onSome: (m) => Effect.succeed(m.id),
            onNone: () =>
              Effect.fail(
                new UsersApiError({
                  message: `Marathon not found for domain ${domain}`,
                })
              ),
          })

          return yield* db.usersQueries.deleteUserMarathonRelation({ userId, marathonId })
        }
      )

      return {
        getStaffMembersByDomain,
        getStaffMemberById,
        createStaffMember,
        deleteUserMarathonRelation,
      } as const
    }),
  }
) {}
