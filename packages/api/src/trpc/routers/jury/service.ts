import "server-only"

import { Config, Effect, Layer, Option, Schema, ServiceMap } from "effect"
import { Database, type NewJuryInvitation } from "@blikka/db"
import { TRPCError } from "@trpc/server"
import { SignJWT, jwtVerify } from "jose"
import { JuryApiError } from "./schemas"

const MAX_EXPIRY_DAYS = 90

const JuryTokenPayloadSchema = Schema.Struct({
  domain: Schema.String,
  invitationId: Schema.Number,
  iat: Schema.Number,
  exp: Schema.Number,
})

type JuryTokenPayload = Schema.Schema.Type<typeof JuryTokenPayloadSchema>

function mapTokenError(message: string, code: TRPCError["code"]) {
  return new TRPCError({
    code,
    message,
  })
}

export class JuryApiService extends ServiceMap.Service<JuryApiService>()(
  "@blikka/api/JuryApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database

      const _generateJuryToken = Effect.fn("JuryApiService._generateJuryToken")(function* (
        domain: string,
        invitationId: number
      ) {
        const secretEnv = yield* Config.string("JURY_JWT_SECRET")
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

      const verifyTokenPayload = Effect.fn("JuryApiService.verifyTokenPayload")(function* ({
        token,
        domain,
      }: {
        token: string
        domain: string
      }) {
        const secretEnv = yield* Config.string("JURY_JWT_SECRET")

        const verified = yield* Effect.tryPromise({
          try: () => jwtVerify(token, new TextEncoder().encode(secretEnv)),
          catch: () => mapTokenError("Invalid token", "NOT_FOUND"),
        })

        const payload = yield* Schema.decodeUnknownEffect(JuryTokenPayloadSchema)(verified.payload).pipe(
          Effect.mapError(() => mapTokenError("Invalid token", "NOT_FOUND"))
        )

        const now = Math.floor(Date.now() / 1000)
        if (payload.exp < now) {
          return yield* Effect.fail(mapTokenError("Invitation expired", "UNAUTHORIZED"))
        }

        if (payload.domain !== domain) {
          return yield* Effect.fail(mapTokenError("Invitation not found", "NOT_FOUND"))
        }

        return payload satisfies JuryTokenPayload
      })

      const getInvitationFromToken = Effect.fn("JuryApiService.getInvitationFromToken")(function* ({
        token,
        domain,
      }: {
        token: string
        domain: string
      }) {
        const payload = yield* verifyTokenPayload({ token, domain })

        const invitation = yield* db.juryQueries
          .getJuryDataByTokenPayload({
            domain,
            invitationId: payload.invitationId,
          })
          .pipe(
            Effect.mapError((error) => {
              const message = error instanceof Error ? error.message : String(error)
              if (message.includes("Invitation not found")) {
                return mapTokenError("Invitation not found", "NOT_FOUND")
              }
              if (message.includes("Marathon not found")) {
                return mapTokenError("Marathon not found", "NOT_FOUND")
              }
              return mapTokenError("Failed to load invitation", "INTERNAL_SERVER_ERROR")
            })
          )

        const invitationExpiry = new Date(invitation.expiresAt)
        if (invitationExpiry < new Date()) {
          return yield* Effect.fail(mapTokenError("Invitation expired", "UNAUTHORIZED"))
        }

        if (invitation.marathon?.mode !== "marathon") {
          return yield* Effect.fail(
            mapTokenError("Unsupported marathon mode", "BAD_REQUEST")
          )
        }

        return invitation
      })

      const ensureInvitationEditable = Effect.fn(
        "JuryApiService.ensureInvitationEditable"
      )(function* ({
        invitation,
      }: {
        invitation: {
          status: string | null
        }
      }) {
        if (invitation.status === "completed") {
          return yield* Effect.fail(
            mapTokenError("Review already completed", "BAD_REQUEST")
          )
        }

        return Effect.void
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

        if (hasCompetitionClassId) {
          if (data.topicId !== null && data.topicId !== undefined) {
            return yield* Effect.fail(
              new JuryApiError({
                message: "Class invites cannot have topic specified.",
              })
            )
          }
        }

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
          token: "",
        }

        const result = yield* db.juryQueries.createJuryInvitation({ data: invitationData })
        const token = yield* _generateJuryToken(domain, result.id)

        yield* db.juryQueries.updateJuryInvitation({
          id: result.id,
          data: { token },
        })

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

        return yield* db.juryQueries.updateJuryInvitation({
          id,
          data: updateData,
        })
      })

      const deleteJuryInvitation = Effect.fn("JuryApiService.deleteJuryInvitation")(function* ({
        id,
      }: {
        id: number
      }) {
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

        return yield* db.juryQueries.deleteJuryInvitation({ id })
      })

      const verifyTokenAndGetInitialData = Effect.fn(
        "JuryApiService.verifyTokenAndGetInitialData"
      )(function* ({
        token,
        domain,
      }: {
        token: string
        domain: string
      }) {
        return yield* getInvitationFromToken({ token, domain })
      })

      const getJurySubmissionsFromToken = Effect.fn(
        "JuryApiService.getJurySubmissionsFromToken"
      )(function* ({
        token,
        domain,
        cursor,
        ratingFilter,
      }: {
        token: string
        domain: string
        cursor?: number
        ratingFilter?: readonly number[]
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })

        const result = yield* db.juryQueries.getJurySubmissionsFromToken({
          invitationId: invitation.id,
          cursor,
          ratingFilter: ratingFilter ? [...ratingFilter] : undefined,
        })

        if (invitation.inviteType !== "class") {
          return result
        }

        const participants = yield* Effect.forEach(
          result.participants,
          (participant) =>
            db.participantsQueries
              .getParticipantByReference({
                domain,
                reference: participant.reference,
              })
              .pipe(
                Effect.map((participantDetails) => {
                  if (Option.isNone(participantDetails)) {
                    return {
                      ...participant,
                      contactSheetKey: null,
                    }
                  }

                  const latestContactSheet =
                    participantDetails.value.contactSheets
                      .slice()
                      .sort(
                        (left, right) =>
                          new Date(right.createdAt).getTime() -
                          new Date(left.createdAt).getTime()
                      )[0] ?? null

                  return {
                    ...participant,
                    contactSheetKey: latestContactSheet?.key ?? null,
                  }
                })
              ),
          { concurrency: 10 }
        )

        return {
          ...result,
          participants,
        }
      })

      const getJuryRatingsByInvitation = Effect.fn(
        "JuryApiService.getJuryRatingsByInvitation"
      )(function* ({
        token,
        domain,
      }: {
        token: string
        domain: string
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        const ratings = yield* db.juryQueries.getJuryRatingsByInvitation({
          invitationId: invitation.id,
        })
        return { ratings }
      })

      const getJuryParticipantCount = Effect.fn("JuryApiService.getJuryParticipantCount")(function* ({
        token,
        domain,
        ratingFilter,
      }: {
        token: string
        domain: string
        ratingFilter?: readonly number[]
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        return yield* db.juryQueries.getJuryParticipantCount({
          invitationId: invitation.id,
          ratingFilter: ratingFilter ? [...ratingFilter] : undefined,
        })
      })

      const createRating = Effect.fn("JuryApiService.createRating")(function* ({
        token,
        domain,
        participantId,
        rating,
        notes,
      }: {
        token: string
        domain: string
        participantId: number
        rating: number
        notes?: string
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        yield* ensureInvitationEditable({ invitation })
        return yield* db.juryQueries.createJuryRating({
          invitationId: invitation.id,
          participantId,
          rating,
          notes,
        })
      })

      const updateRating = Effect.fn("JuryApiService.updateRating")(function* ({
        token,
        domain,
        participantId,
        rating,
        notes,
        finalRanking,
      }: {
        token: string
        domain: string
        participantId: number
        rating: number
        notes?: string
        finalRanking?: number
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        yield* ensureInvitationEditable({ invitation })
        return yield* db.juryQueries.updateJuryRating({
          invitationId: invitation.id,
          participantId,
          rating,
          notes,
          finalRanking,
        })
      })

      const getRating = Effect.fn("JuryApiService.getRating")(function* ({
        token,
        domain,
        participantId,
      }: {
        token: string
        domain: string
        participantId: number
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        const result = yield* db.juryQueries.getJuryRating({
          invitationId: invitation.id,
          participantId,
        })

        return yield* Option.match(result, {
          onSome: (rating) => Effect.succeed(rating),
          onNone: () => Effect.succeed(null),
        })
      })

      const deleteRating = Effect.fn("JuryApiService.deleteRating")(function* ({
        token,
        domain,
        participantId,
      }: {
        token: string
        domain: string
        participantId: number
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        yield* ensureInvitationEditable({ invitation })
        const deleted = yield* db.juryQueries.deleteJuryRating({
          invitationId: invitation.id,
          participantId,
        })

        return yield* Option.match(deleted, {
          onSome: (result) => Effect.succeed(result[0]?.id ?? null),
          onNone: () => Effect.succeed(null),
        })
      })

      const updateInvitationStatusByToken = Effect.fn(
        "JuryApiService.updateInvitationStatusByToken"
      )(function* ({
        token,
        domain,
        status,
      }: {
        token: string
        domain: string
        status: "pending" | "in_progress" | "completed"
      }) {
        const invitation = yield* getInvitationFromToken({ token, domain })
        if (invitation.status === "completed" && status !== "completed") {
          return yield* Effect.fail(
            mapTokenError("Review already completed", "BAD_REQUEST")
          )
        }

        yield* db.juryQueries.updateJuryInvitation({
          id: invitation.id,
          data: {
            status,
            updatedAt: new Date().toISOString(),
          },
        })

        return yield* getInvitationFromToken({ token, domain })
      })

      return {
        getJuryInvitationsByDomain,
        getJuryInvitationById,
        createJuryInvitation,
        updateJuryInvitation,
        deleteJuryInvitation,
        verifyTokenPayload,
        verifyTokenAndGetInitialData,
        getJurySubmissionsFromToken,
        getJuryRatingsByInvitation,
        getJuryParticipantCount,
        createRating,
        updateRating,
        getRating,
        deleteRating,
        updateInvitationStatusByToken,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Database.layer)
  )
}
