import "server-only"

import { Effect, Option, Config } from "effect"
import { Database, type NewJuryInvitation } from "@blikka/db"
import { JuryApiError } from "./schemas"
import { SignJWT } from "jose"

const MAX_EXPIRY_DAYS = 90

export class JuryApiService extends Effect.Service<JuryApiService>()(
  "@blikka/api-v2/JuryApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database

      const _generateJuryToken = Effect.fn("JuryApiService._generateJuryToken")(function* (
        domain: string,
        invitationId: number
      ) {
        const secretEnv = yield* Config.string("JURY_JWT_SECRET").pipe(
          Effect.mapError(
            (error) =>
              new JuryApiError({
                message: `JURY_JWT_SECRET is not set: ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
              })
          )
        )
        const secret = new TextEncoder().encode(secretEnv)
        const iat = Math.floor(Date.now() / 1000)
        const exp = iat + 60 * 60 * 24 * MAX_EXPIRY_DAYS

        const payload = {
          domain,
          invitationId,
          iat,
          exp,
        }

        return yield* Effect.tryPromise({
          try: () =>
            new SignJWT(payload)
              .setProtectedHeader({ alg: "HS256" })
              .setIssuedAt(iat)
              .setExpirationTime(exp)
              .sign(secret),
          catch: (error) =>
            new JuryApiError({
              message: `Failed to generate jury token: ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        })
      })

      const getJuryInvitationsByDomain = Effect.fn("JuryApiService.getJuryInvitationsByDomain")(
        function* ({ domain }: { domain: string }) {
          return yield* db.juryQueries.getJuryInvitationsByDomain({ domain })
        }
      )

      const getJuryInvitationById = Effect.fn("JuryApiService.getJuryInvitationById")(function* ({
        id,
      }: {
        id: number
      }) {
        const result = yield* db.juryQueries.getJuryInvitationById({ id })
        return yield* Option.match(result, {
          onSome: (invitation) => Effect.succeed(invitation),
          onNone: () =>
            Effect.fail(
              new JuryApiError({
                message: `Jury invitation not found for id ${id}`,
              })
            ),
        })
      })

      const createJuryInvitation = Effect.fn("JuryApiService.createJuryInvitation")(function* ({
        domain,
        data,
      }: {
        domain: string
        data: {
          email: string
          displayName: string
          inviteType: "topic" | "class"
          topicId?: number
          competitionClassId?: number
          deviceGroupId?: number
          expiresAt: string
          notes?: string
          status?: string
        }
      }) {
        // Validate invite type logic
        const hasTopicId = data.topicId !== null && data.topicId !== undefined
        const hasCompetitionClassId =
          data.competitionClassId !== null && data.competitionClassId !== undefined

        if (hasTopicId && hasCompetitionClassId) {
          return yield* Effect.fail(
            new JuryApiError({
              message:
                "Cannot create invitation with both topic and competition class. Choose either topic invite or class invite.",
            })
          )
        }

        if (!hasTopicId && !hasCompetitionClassId) {
          return yield* Effect.fail(
            new JuryApiError({
              message:
                "Must specify either topicId for topic invite or competitionClassId for class invite.",
            })
          )
        }

        // For topic invites: ensure competition_class_id and device_group_id are null
        if (hasTopicId) {
          if (data.competitionClassId !== null && data.competitionClassId !== undefined) {
            return yield* Effect.fail(
              new JuryApiError({
                message: "Topic invites cannot have competition class specified.",
              })
            )
          }
          if (data.deviceGroupId !== null && data.deviceGroupId !== undefined) {
            return yield* Effect.fail(
              new JuryApiError({
                message: "Topic invites cannot have device group specified.",
              })
            )
          }
        }

        // For class invites: ensure topic_id is null
        if (hasCompetitionClassId) {
          if (data.topicId !== null && data.topicId !== undefined) {
            return yield* Effect.fail(
              new JuryApiError({
                message: "Class invites cannot have topic specified.",
              })
            )
          }
        }

        // Get marathon to get marathonId
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })
        const marathonId = yield* Option.match(marathon, {
          onSome: (m) => Effect.succeed(m.id),
          onNone: () =>
            Effect.fail(
              new JuryApiError({
                message: `Marathon not found for domain ${domain}`,
              })
            ),
        })

        // Create invitation with empty token first
        const invitationData: NewJuryInvitation = {
          email: data.email,
          displayName: data.displayName,
          inviteType: data.inviteType,
          topicId: data.topicId ?? null,
          competitionClassId: data.competitionClassId ?? null,
          deviceGroupId: data.deviceGroupId ?? null,
          expiresAt: data.expiresAt,
          notes: data.notes ?? null,
          status: data.status ?? "pending",
          marathonId,
          token: "", // Will be updated after creation
        }

        const result = yield* db.juryQueries.createJuryInvitation({ data: invitationData })

        // Generate token and update invitation
        const token = yield* _generateJuryToken(domain, result.id)

        yield* db.juryQueries.updateJuryInvitation({
          id: result.id,
          data: { token },
        })

        // Return the created invitation
        const createdInvitation = yield* db.juryQueries.getJuryInvitationById({ id: result.id })
        return yield* Option.match(createdInvitation, {
          onSome: (invitation) => Effect.succeed(invitation),
          onNone: () =>
            Effect.fail(
              new JuryApiError({
                message: `Failed to retrieve created invitation with id ${result.id}`,
              })
            ),
        })
      })

      const updateJuryInvitation = Effect.fn("JuryApiService.updateJuryInvitation")(function* ({
        id,
        data,
      }: {
        id: number
        data: Partial<NewJuryInvitation>
      }) {
        // Verify invitation exists
        const existingInvitation = yield* db.juryQueries.getJuryInvitationById({ id })
        yield* Option.match(existingInvitation, {
          onSome: () => Effect.void,
          onNone: () =>
            Effect.fail(
              new JuryApiError({
                message: `Jury invitation not found for id ${id}`,
              })
            ),
        })

        const updateData = {
          ...data,
          updatedAt: new Date().toISOString(),
        } satisfies Partial<NewJuryInvitation>

        const result = yield* db.juryQueries.updateJuryInvitation({
          id,
          data: updateData,
        })

        return result
      })

      const deleteJuryInvitation = Effect.fn("JuryApiService.deleteJuryInvitation")(function* ({
        id,
      }: {
        id: number
      }) {
        // Verify invitation exists
        const existingInvitation = yield* db.juryQueries.getJuryInvitationById({ id })
        yield* Option.match(existingInvitation, {
          onSome: () => Effect.void,
          onNone: () =>
            Effect.fail(
              new JuryApiError({
                message: `Jury invitation not found for id ${id}`,
              })
            ),
        })

        const result = yield* db.juryQueries.deleteJuryInvitation({ id })
        return result
      })

      return {
        getJuryInvitationsByDomain,
        getJuryInvitationById,
        createJuryInvitation,
        updateJuryInvitation,
        deleteJuryInvitation,
      } as const
    }),
  }
) {}
