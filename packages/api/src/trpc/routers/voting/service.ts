import "server-only"

import { Config, Effect, Layer, Option, ServiceMap } from "effect"
import { Database, type VotingSession, type NewVotingSession } from "@blikka/db"
import { VotingApiError } from "./schemas"
import { SMSService } from "@blikka/aws"
import {
  PhoneNumberEncryptionService,
  type EncryptedPhoneNumber,
} from "../../utils/phone-number-encryption"
import { randomBytes } from "crypto"
import {
  getVotingLifecycleState,
  hasSubmissionWindowEnded,
  parseVotingScheduleInput,
} from "./lifecycle"

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com"

function buildS3Url(
  bucketName: string,
  key: string | null | undefined,
): string | undefined {
  if (!key) return undefined
  return `${AWS_S3_BASE_URL}/${bucketName}/${key}`
}

function parseVotingWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string
  endsAt?: string | null
}): Effect.Effect<
  { startsAtIso: string; endsAtIso: string | null },
  VotingApiError
> {
  return Effect.try({
    try: () => parseVotingScheduleInput({ startsAt, endsAt }),
    catch: (error) =>
      new VotingApiError({
        message:
          error instanceof Error ? error.message : "Invalid voting timestamps",
        cause: error,
      }),
  })
}

function ensureSessionDomain(
  votingSession: VotingSession & { marathon?: { domain: string } | null },
  domain: string,
): Effect.Effect<void, VotingApiError> {
  if (
    votingSession.marathon?.domain &&
    votingSession.marathon.domain !== domain
  ) {
    return Effect.fail(
      new VotingApiError({
        message: "Voting session not found",
      }),
    )
  }

  return Effect.void
}

function ensureVotingSessionWindow(votingWindow: {
  startsAt: string | null
  endsAt: string | null
}): Effect.Effect<void, VotingApiError> {
  const state = getVotingLifecycleState(votingWindow)

  if (state === "not-started") {
    return Effect.fail(
      new VotingApiError({
        message: "Voting session has not started yet",
      }),
    )
  }

  if (state === "ended") {
    return Effect.fail(
      new VotingApiError({
        message: "Voting session has expired",
      }),
    )
  }

  return Effect.void
}

function normalizePaginationInput({
  page,
  limit,
}: {
  page?: number | null
  limit?: number | null
}) {
  const normalizedPage = Number.isInteger(page) && page && page > 0 ? page : 1
  const normalizedLimit =
    Number.isInteger(limit) && limit && limit > 0 ? Math.min(limit, 100) : 50

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  }
}

export class VotingApiService extends ServiceMap.Service<VotingApiService>()(
  "@blikka/api/VotingApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const smsService = yield* SMSService
      const phoneEncryption = yield* PhoneNumberEncryptionService

      const submissionsBucketName = yield* Config.string(
        "SUBMISSIONS_BUCKET_NAME",
      )
      const thumbnailsBucketName = yield* Config.string(
        "THUMBNAILS_BUCKET_NAME",
      )

      const generateUniqueToken = Effect.fn(
        "VotingApiService.generateUniqueToken",
      )(function* ({
        usedTokens = new Set<string>(),
      }: { usedTokens?: Set<string> } = {}) {
        while (true) {
          const token = randomBytes(8).toString("base64url").slice(0, 8)
          if (usedTokens.has(token)) {
            continue
          }
          const existing = yield* db.votingQueries.getVotingSessionByToken({
            token,
          })
          if (Option.isNone(existing)) {
            usedTokens.add(token)
            return token
          }
        }
      })

      const getByCameraMarathonWithTopic = Effect.fn(
        "VotingApiService.getByCameraMarathonWithTopic",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          })

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        })

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          )
        }

        const topic = marathon.topics.find((item) => item.id === topicId)
        if (!topic) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Topic not found",
            }),
          )
        }

        return {
          marathon,
          topic,
          activeTopic:
            marathon.topics.find((item) => item.visibility === "active") ??
            null,
        }
      })

      const getTopicVotingWindow = Effect.fn(
        "VotingApiService.getTopicVotingWindow",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const votingWindow = yield* db.votingQueries.getVotingWindowForTopic({
          marathonId,
          topicId,
        })

        if (!votingWindow) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting topic not found",
            }),
          )
        }

        return {
          startsAt: votingWindow.startsAt,
          endsAt: votingWindow.endsAt,
        }
      })

      const getVotingSession = Effect.fn("VotingApiService.getVotingSession")(
        function* ({ token, domain }: { token: string; domain: string }) {
          const votingSessionResult =
            yield* db.votingQueries.getVotingSessionByToken({ token })

          const votingSession = yield* Option.match(votingSessionResult, {
            onSome: (session) => Effect.succeed(session),
            onNone: () =>
              Effect.fail(
                new VotingApiError({
                  message: "Voting session not found",
                }),
              ),
          })

          yield* ensureSessionDomain(votingSession, domain)

          const votingWindow = yield* getTopicVotingWindow({
            marathonId: votingSession.marathonId,
            topicId: votingSession.topicId,
          })

          return {
            ...votingSession,
            startsAt: votingWindow.startsAt,
            endsAt: votingWindow.endsAt,
          }
        },
      )

      const setTopicVotingWindow = Effect.fn(
        "VotingApiService.setTopicVotingWindow",
      )(function* ({
        domain,
        topicId,
        startsAt,
        endsAt,
      }: {
        domain: string
        topicId: number
        startsAt: string
        endsAt?: string | null
      }) {
        const { startsAtIso, endsAtIso } = yield* parseVotingWindow({
          startsAt,
          endsAt,
        })

        const { marathon, topic, activeTopic } =
          yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Voting window can only be configured for the active by-camera topic",
            }),
          )
        }

        const window = yield* db.votingQueries.upsertTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
        })
        if (!window) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to upsert voting window",
            }),
          )
        }

        return {
          topicId,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
        }
      })

      const closeTopicVotingWindow = Effect.fn(
        "VotingApiService.closeTopicVotingWindow",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const { marathon, topic, activeTopic } =
          yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Voting window can only be closed for the active by-camera topic",
            }),
          )
        }

        const votingWindow = yield* getTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
        })

        const votingState = getVotingLifecycleState(votingWindow)
        if (votingState !== "active") {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                votingState === "ended"
                  ? "Voting has already ended for this topic"
                  : "Voting has not started for this topic",
            }),
          )
        }

        const nowIso = new Date().toISOString()

        const updatedWindow = yield* db.votingQueries.closeTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
          nowIso,
        })

        if (!updatedWindow) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to close voting window",
            }),
          )
        }

        return {
          topicId,
          startsAt: updatedWindow.startsAt,
          endsAt: updatedWindow.endsAt,
        }
      })

      const startVotingSessions = Effect.fn(
        "VotingApiService.startVotingSessions",
      )(function* ({
        domain,
        topicId,
        endsAt,
      }: {
        domain: string
        topicId: number
        endsAt?: string | null
      }) {
        const { marathon, topic, activeTopic } =
          yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Voting can only be started for the active by-camera topic",
            }),
          )
        }

        if (topic.votingStartsAt) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting has already been started for this topic",
            }),
          )
        }

        if (!hasSubmissionWindowEnded(topic.scheduledEnd)) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Voting cannot start until submissions have ended for the active topic",
            }),
          )
        }

        const nowIso = new Date().toISOString()
        const { startsAtIso, endsAtIso } = yield* parseVotingWindow({
          startsAt: nowIso,
          endsAt,
        })

        const existingCount =
          yield* db.votingQueries.countVotingSessionsForTopic({
            marathonId: marathon.id,
            topicId,
          })

        const participantsWithoutSession =
          yield* db.votingQueries.getParticipantsWithSubmissionsButNoVotingSession(
            {
              marathonId: marathon.id,
              topicId,
            },
          )

        if (existingCount === 0 && participantsWithoutSession.length === 0) {
          const participantsWithSubmissions =
            yield* db.votingQueries.getParticipantsWithSubmissionsByTopicId({
              marathonId: marathon.id,
              topicId,
            })

          if (participantsWithSubmissions.length === 0) {
            return yield* Effect.fail(
              new VotingApiError({
                message:
                  "No participants with submissions found for this topic",
              }),
            )
          }
        }

        const votingWindow = yield* db.votingQueries.upsertTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
        })

        if (!votingWindow) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to start voting for this topic",
            }),
          )
        }

        const fullParticipants = yield* Effect.all(
          participantsWithoutSession.map((participant) =>
            db.participantsQueries.getParticipantById({ id: participant.id }),
          ),
        )

        const participantData = fullParticipants.flatMap((participantOpt) =>
          Option.isSome(participantOpt) ? [participantOpt.value] : [],
        )

        if (existingCount === 0 && participantData.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Could not load participant data for this topic",
            }),
          )
        }

        const usedTokens = new Set<string>()
        const sessionsToCreate: NewVotingSession[] = yield* Effect.forEach(
          participantData,
          (participant) =>
            Effect.gen(function* () {
              const token = yield* generateUniqueToken({ usedTokens })

              return {
                token,
                firstName: participant.firstname,
                lastName: participant.lastname,
                email: participant.email ?? "",
                phoneHash: participant.phoneHash,
                phoneEncrypted: participant.phoneEncrypted,
                marathonId: marathon.id,
                voteSubmissionId: null,
                connectedParticipantId: participant.id,
                notificationLastSentAt: null,
                topicId,
              } satisfies NewVotingSession
            }),
          { concurrency: 1 },
        )

        const createdSessions = yield* db.votingQueries.createVotingSessions({
          sessions: sessionsToCreate,
        })

        const smsResults = yield* Effect.all(
          createdSessions
            .filter((session) => session.phoneEncrypted)
            .map((session) =>
              Effect.gen(function* () {
                const phoneNumber = yield* phoneEncryption.decrypt({
                  encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
                })

                const message = `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`

                const result = yield* smsService.sendWithOptOutCheck({
                  phoneNumber,
                  message,
                })

                return {
                  sessionId: session.id,
                  phoneNumber,
                  smsResult: result,
                }
              }).pipe(
                Effect.catch((error) =>
                  Effect.succeed({
                    sessionId: session.id,
                    phoneNumber: null,
                    error: String(error),
                  }),
                ),
              ),
            ),
          { concurrency: 5 },
        )

        if (createdSessions.length > 0) {
          yield* db.votingQueries.updateMultipleLastNotificationSentAt({
            ids: createdSessions.map((session) => session.id),
            notificationLastSentAt: new Date().toISOString(),
          })
        }

        return {
          topicId,
          votingWindow,
          sessionsCreated: createdSessions.length,
          smsSent: smsResults.filter((result) => !("error" in result)).length,
          smsResults,
          existingSessions: existingCount,
        }
      })

      const getParticipantsWithoutVotingSession = Effect.fn(
        "VotingApiService.getParticipantsWithoutVotingSession",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const existingCount =
          yield* db.votingQueries.countVotingSessionsForTopic({
            marathonId: marathon.id,
            topicId,
          })

        if (existingCount === 0) {
          return []
        }

        return yield* db.votingQueries.getParticipantsWithSubmissionsButNoVotingSession(
          {
            marathonId: marathon.id,
            topicId,
          },
        )
      })

      const startVotingSessionsForParticipants = Effect.fn(
        "VotingApiService.startVotingSessionsForParticipants",
      )(function* ({
        domain,
        topicId,
        participantIds,
      }: {
        domain: string
        topicId: number
        participantIds: readonly number[]
      }) {
        const { marathon, topic, activeTopic } =
          yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Voting can only be started for the active by-camera topic",
            }),
          )
        }
        const votingWindow = yield* getTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
        })

        yield* ensureVotingSessionWindow(votingWindow)

        if (participantIds.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No participant IDs provided",
            }),
          )
        }

        const participantsWithSubmissions =
          yield* db.votingQueries.getParticipantsWithSubmissionsButNoVotingSession(
            {
              marathonId: marathon.id,
              topicId,
            },
          )

        const validParticipantIds = new Set(
          participantsWithSubmissions.map((p) => p.id),
        )
        const idsToProcess = participantIds.filter((id) =>
          validParticipantIds.has(id),
        )

        if (idsToProcess.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "None of the provided participants are eligible (they may already have sessions or no submissions for this topic)",
            }),
          )
        }

        const fullParticipants = yield* Effect.all(
          idsToProcess.map((id) =>
            db.participantsQueries.getParticipantById({ id }),
          ),
        )

        const participantData = fullParticipants.flatMap((opt) =>
          Option.isSome(opt) ? [opt.value] : [],
        )

        if (participantData.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Could not load participant data",
            }),
          )
        }

        const usedTokens = new Set<string>()
        const sessionsToCreate: NewVotingSession[] = yield* Effect.forEach(
          participantData,
          (participant) =>
            Effect.gen(function* () {
              const token = yield* generateUniqueToken({ usedTokens })

              return {
                token,
                firstName: participant.firstname,
                lastName: participant.lastname,
                email: participant.email ?? "",
                phoneHash: participant.phoneHash,
                phoneEncrypted: participant.phoneEncrypted,
                marathonId: marathon.id,
                voteSubmissionId: null,
                connectedParticipantId: participant.id,
                notificationLastSentAt: null,
                topicId,
              } satisfies NewVotingSession
            }),
          { concurrency: 1 },
        )

        const createdSessions = yield* db.votingQueries.createVotingSessions({
          sessions: sessionsToCreate,
        })

        const smsResults = yield* Effect.all(
          createdSessions
            .filter((session) => session.phoneEncrypted)
            .map((session) =>
              Effect.gen(function* () {
                const phoneNumber = yield* phoneEncryption.decrypt({
                  encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
                })

                const message = `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`

                const result = yield* smsService.sendWithOptOutCheck({
                  phoneNumber,
                  message,
                })

                return {
                  sessionId: session.id,
                  phoneNumber,
                  smsResult: result,
                }
              }).pipe(
                Effect.catch((error) =>
                  Effect.succeed({
                    sessionId: session.id,
                    phoneNumber: null,
                    error: String(error),
                  }),
                ),
              ),
            ),
          { concurrency: 5 },
        )

        if (createdSessions.length > 0) {
          yield* db.votingQueries.updateMultipleLastNotificationSentAt({
            ids: createdSessions.map((session) => session.id),
            notificationLastSentAt: new Date().toISOString(),
          })
        }

        return {
          topicId,
          votingWindow,
          sessionsCreated: createdSessions.length,
          smsSent: smsResults.filter((result) => !("error" in result)).length,
          smsResults,
        }
      })

      const getSubmissionVoteStats = Effect.fn(
        "VotingApiService.getSubmissionVoteStats",
      )(function* ({
        submissionId,
        domain,
      }: {
        submissionId: number
        domain: string
      }) {
        const statsResult = yield* db.votingQueries.getSubmissionVoteStats({
          submissionId,
          domain,
        })

        const stats = yield* Option.match(statsResult, {
          onSome: (s) => Effect.succeed(s),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Failed to get vote stats",
              }),
            ),
        })

        const submission = yield* db.submissionsQueries.getSubmissionById({
          id: submissionId,
        })

        let participantVoteInfo = null
        if (Option.isSome(submission)) {
          const participantId = submission.value.participantId
          const voteInfoResult = yield* db.votingQueries.getParticipantVoteInfo(
            {
              participantId,
              topicId: submission.value.topicId,
            },
          )

          if (Option.isSome(voteInfoResult)) {
            participantVoteInfo = voteInfoResult.value
          }
        }

        return {
          ...stats,
          participantVoteInfo,
        }
      })

      const createOrUpdateVotingSessionForParticipant = Effect.fn(
        "VotingApiService.createOrUpdateVotingSessionForParticipant",
      )(function* ({
        participantId,
        domain,
        topicId,
      }: {
        participantId: number
        domain: string
        topicId: number
      }) {
        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          })

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        })

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          )
        }

        const participantOpt = yield* db.participantsQueries.getParticipantById(
          {
            id: participantId,
          },
        )

        const participant = yield* Option.match(participantOpt, {
          onSome: (p) => Effect.succeed(p),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Participant not found with id ${participantId}`,
              }),
            ),
        })

        const submissions =
          yield* db.submissionsQueries.getSubmissionsByParticipantId({
            participantId,
          })

        if (!submissions.some((submission) => submission.topicId === topicId)) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Participant has no submissions for this topic",
            }),
          )
        }

        const votingWindow = yield* getTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
        })

        yield* ensureVotingSessionWindow(votingWindow)

        const existingSessionOpt =
          yield* db.votingQueries.getVotingSessionByParticipantAndTopicId({
            participantId,
            topicId,
          })

        if (Option.isSome(existingSessionOpt)) {
          const existingSession = existingSessionOpt.value
          if (existingSession.votedAt) {
            return {
              action: "already_voted" as const,
              session: existingSession,
            }
          }
        }

        const nowIso = new Date().toISOString()

        const sessionData: NewVotingSession = {
          token: yield* generateUniqueToken(),
          firstName: participant.firstname,
          lastName: participant.lastname,
          email: participant.email ?? "",
          phoneHash: participant.phoneHash,
          phoneEncrypted: participant.phoneEncrypted,
          marathonId: marathon.id,
          voteSubmissionId: null,
          connectedParticipantId: participantId,
          notificationLastSentAt: nowIso,
          topicId,
        }

        const session = yield* db.votingQueries.upsertVotingSession(sessionData)

        let smsResult = null
        if (session.phoneEncrypted) {
          const smsResult_ = yield* Effect.gen(function* () {
            const phoneNumber = yield* phoneEncryption.decrypt({
              encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
            })

            const message = `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`

            const result = yield* smsService.sendWithOptOutCheck({
              phoneNumber,
              message,
            })

            return {
              phoneNumber,
              smsResult: result,
            }
          }).pipe(
            Effect.catch((error) =>
              Effect.succeed({
                phoneNumber: null,
                error: String(error),
              }),
            ),
          )
          smsResult = smsResult_
        }

        const action = Option.isSome(existingSessionOpt) ? "resent" : "created"

        return {
          action,
          session,
          smsSent: smsResult && !("error" in smsResult),
          smsError: smsResult && "error" in smsResult ? smsResult.error : null,
        }
      })

      const getVotingSessionByParticipant = Effect.fn(
        "VotingApiService.getVotingSessionByParticipant",
      )(function* ({
        participantId,
        topicId,
      }: {
        participantId: number
        topicId: number
      }) {
        const sessionOpt =
          yield* db.votingQueries.getVotingSessionByParticipantAndTopicId({
            participantId,
            topicId,
          })

        return Option.match(sessionOpt, {
          onSome: (session) => ({
            hasSession: true as const,
            session,
            hasVoted: session.votedAt !== null,
            notificationLastSentAt: session.notificationLastSentAt,
          }),
          onNone: () => ({
            hasSession: false as const,
          }),
        })
      })

      const getVotingAdminSummary = Effect.fn(
        "VotingApiService.getVotingAdminSummary",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const { marathon, topic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const [
          sessionStatsResult,
          votingWindowResult,
          submissionCount,
          participantWithSubmissionCount,
          topRankRows,
        ] = yield* Effect.all([
          db.votingQueries.getVotingSessionStatsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          db.votingQueries.getVotingWindowForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          db.votingQueries.countSubmissionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          db.votingQueries.countParticipantsWithSubmissionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          db.votingQueries.getTopRanksPreviewForTopic({
            marathonId: marathon.id,
            topicId,
          }),
        ])

        type TopRankPreviewEntry = {
          rank: number
          submissionId: number
          submissionCreatedAt: string
          submissionKey: string | null
          submissionThumbnailKey: string | null
          participantId: number
          participantFirstName: string
          participantLastName: string
          participantReference: string
          voteCount: number
          tieSize: number
          isTie: boolean
        }

        const topRanks = Array.from(
          topRankRows.reduce((acc, row) => {
            if (!acc.has(row.rank)) {
              acc.set(row.rank, [])
            }

            acc.get(row.rank)!.push({
              rank: row.rank,
              submissionId: row.submissionId,
              submissionCreatedAt: row.submissionCreatedAt,
              submissionKey: row.submissionKey,
              submissionThumbnailKey: row.submissionThumbnailKey,
              participantId: row.participantId,
              participantFirstName: row.participantFirstName,
              participantLastName: row.participantLastName,
              participantReference: row.participantReference,
              voteCount: row.voteCount,
              tieSize: row.tieSize,
              isTie: row.tieSize > 1,
            })

            return acc
          }, new Map<number, TopRankPreviewEntry[]>()),
        )
          .sort(([rankA], [rankB]) => rankA - rankB)
          .map(([rank, entries]) => ({
            rank,
            entries,
          }))

        const pendingSessions =
          sessionStatsResult.total - sessionStatsResult.completed

        return {
          topic: {
            id: topic.id,
            name: topic.name,
            orderIndex: topic.orderIndex,
            activatedAt: topic.activatedAt,
          },
          votingWindow: {
            startsAt: votingWindowResult?.startsAt ?? null,
            endsAt: votingWindowResult?.endsAt ?? null,
          },
          sessionStats: {
            total: sessionStatsResult.total,
            completed: sessionStatsResult.completed,
            pending: pendingSessions,
            participantSessions: sessionStatsResult.participantSessions,
            manualSessions: sessionStatsResult.manualSessions,
          },
          voteStats: {
            totalVotes: sessionStatsResult.completed,
          },
          submissionStats: {
            submissionCount,
            participantWithSubmissionCount,
          },
          topRanks,
        }
      })

      const getVotingLeaderboardPage = Effect.fn(
        "VotingApiService.getVotingLeaderboardPage",
      )(function* ({
        domain,
        topicId,
        page,
        limit,
      }: {
        domain: string
        topicId: number
        page?: number | null
        limit?: number | null
      }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })
        const { page: normalizedPage, limit: normalizedLimit } =
          normalizePaginationInput({
            page,
            limit,
          })

        const [items, total] = yield* Effect.all([
          db.votingQueries.getLeaderboardPageForTopic({
            marathonId: marathon.id,
            topicId,
            page: normalizedPage,
            limit: normalizedLimit,
          }),
          db.votingQueries.countSubmissionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
        ])

        return {
          items: items.map((entry) => ({
            rank: entry.rank,
            submissionId: entry.submissionId,
            submissionCreatedAt: entry.submissionCreatedAt,
            submissionKey: entry.submissionKey,
            submissionThumbnailKey: entry.submissionThumbnailKey,
            participantId: entry.participantId,
            participantFirstName: entry.participantFirstName,
            participantLastName: entry.participantLastName,
            participantReference: entry.participantReference,
            voteCount: entry.voteCount,
            tieSize: entry.tieSize,
            isTie: entry.tieSize > 1,
          })),
          total,
          page: normalizedPage,
          limit: normalizedLimit,
          pageCount: total > 0 ? Math.ceil(total / normalizedLimit) : 0,
        }
      })

      const getVotingVotersPage = Effect.fn(
        "VotingApiService.getVotingVotersPage",
      )(function* ({
        domain,
        topicId,
        page,
        limit,
      }: {
        domain: string
        topicId: number
        page?: number | null
        limit?: number | null
      }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })
        const { page: normalizedPage, limit: normalizedLimit } =
          normalizePaginationInput({
            page,
            limit,
          })

        const [sessions, total] = yield* Effect.all([
          db.votingQueries.getVotersPageForTopic({
            marathonId: marathon.id,
            topicId,
            page: normalizedPage,
            limit: normalizedLimit,
          }),
          db.votingQueries.countVotingSessionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
        ])

        type VoteSubmissionDetails = {
          id: number
          key: string
          thumbnailKey: string | null
          createdAt: string
          participant?: {
            reference: string
            firstname: string
            lastname: string
          } | null
        }

        const items = yield* Effect.forEach(
          sessions,
          (session) =>
            Effect.gen(function* () {
              const phoneNumber = session.phoneEncrypted
                ? yield* phoneEncryption
                    .decrypt({
                      encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
                    })
                    .pipe(Effect.catch(() => Effect.succeed(null)))
                : null

              const voteSubmission =
                "submissions" in session
                  ? ((session as { submissions?: VoteSubmissionDetails | null })
                      .submissions ?? null)
                  : null

              return {
                sessionId: session.id,
                firstName: session.firstName,
                lastName: session.lastName,
                email: session.email,
                token: session.token,
                phoneNumber,
                notificationLastSentAt: session.notificationLastSentAt,
                connectedParticipantId: session.connectedParticipantId,
                votedAt: session.votedAt,
                voteSubmission: voteSubmission
                  ? {
                      submissionId: voteSubmission.id,
                      participantReference:
                        voteSubmission.participant?.reference ?? null,
                      participantFirstName:
                        voteSubmission.participant?.firstname ?? null,
                      participantLastName:
                        voteSubmission.participant?.lastname ?? null,
                      thumbnailKey: voteSubmission.thumbnailKey,
                      key: voteSubmission.key,
                      createdAt: voteSubmission.createdAt,
                    }
                  : null,
              }
            }),
          { concurrency: 5 },
        )

        return {
          items,
          total,
          page: normalizedPage,
          limit: normalizedLimit,
          pageCount: total > 0 ? Math.ceil(total / normalizedLimit) : 0,
        }
      })

      const createManualVotingSession = Effect.fn(
        "VotingApiService.createManualVotingSession",
      )(function* ({
        domain,
        topicId,
        firstName,
        lastName,
        email,
      }: {
        domain: string
        topicId: number
        firstName: string
        lastName: string
        email: string
      }) {
        const parsedFirstName = firstName.trim()
        const parsedLastName = lastName.trim()
        const parsedEmail = email.trim()

        if (!parsedFirstName || !parsedLastName || !parsedEmail) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "First name, last name and email are required",
            }),
          )
        }

        const { marathon, topic, activeTopic } =
          yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })
        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Manual invites are only allowed on the active by-camera topic",
            }),
          )
        }
        const votingWindow = yield* getTopicVotingWindow({
          marathonId: marathon.id,
          topicId,
        })

        yield* ensureVotingSessionWindow(votingWindow)

        const created = yield* db.votingQueries.createVotingSessions({
          sessions: [
            {
              token: yield* generateUniqueToken(),
              firstName: parsedFirstName,
              lastName: parsedLastName,
              email: parsedEmail,
              phoneHash: null,
              phoneEncrypted: null,
              marathonId: marathon.id,
              voteSubmissionId: null,
              connectedParticipantId: null,
              notificationLastSentAt: null,
              topicId,
            },
          ],
        })

        const createdSession = created[0]
        if (!createdSession) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to create manual voting session",
            }),
          )
        }

        return {
          session: createdSession,
          votingUrl: `https://${domain}.blikka.app/live/vote/${createdSession.token}`,
        }
      })

      const resendVotingSessionNotification = Effect.fn(
        "VotingApiService.resendVotingSessionNotification",
      )(function* ({
        domain,
        topicId,
        sessionId,
      }: {
        domain: string
        topicId: number
        sessionId: number
      }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const sessionOpt = yield* db.votingQueries.getVotingSessionByIdForTopic(
          {
            marathonId: marathon.id,
            topicId,
            sessionId,
          },
        )
        const session = yield* Option.match(sessionOpt, {
          onSome: (s) => Effect.succeed(s),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found for the selected topic",
              }),
            ),
        })

        if (!session.phoneEncrypted) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "This voter has no phone number, so SMS notification cannot be sent",
            }),
          )
        }

        const phoneNumber = yield* phoneEncryption
          .decrypt({
            encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
          })
          .pipe(
            Effect.mapError(
              () =>
                new VotingApiError({
                  message: "Failed to decrypt phone number for this voter",
                }),
            ),
          )

        yield* smsService
          .sendWithOptOutCheck({
            phoneNumber,
            message: `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`,
          })
          .pipe(
            Effect.mapError(
              (error) =>
                new VotingApiError({
                  message:
                    error instanceof Error
                      ? error.message
                      : "Failed to send voting notification to this voter",
                  cause: error,
                }),
            ),
          )

        const notificationLastSentAt = new Date().toISOString()
        yield* db.votingQueries.updateMultipleLastNotificationSentAt({
          ids: [session.id],
          notificationLastSentAt,
        })

        return {
          sessionId: session.id,
          notificationLastSentAt,
        }
      })

      const getVotingSubmissions = Effect.fn(
        "VotingApiService.getVotingSubmissions",
      )(function* ({ token, domain }: { token: string; domain: string }) {
        const votingSessionResult =
          yield* db.votingQueries.getVotingSessionByToken({ token })

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        // yield* ensureSessionDomain(votingSession, domain)
        const votingWindow = yield* getTopicVotingWindow({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        if (votingSession.votedAt && votingSession.voteSubmissionId) {
          return {
            alreadyVoted: true,
            votedAt: votingSession.votedAt,
            votedSubmissionId: votingSession.voteSubmissionId,
            submissions: [],
            sessionInfo: {
              token: votingSession.token,
              firstName: votingSession.firstName,
              lastName: votingSession.lastName,
              email: votingSession.email,
              startsAt: votingWindow.startsAt,
              endsAt: votingWindow.endsAt,
            },
          }
        }

        yield* ensureVotingSessionWindow(votingWindow)

        const submissions = yield* db.votingQueries.getSubmissionsForVoting({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        const votingSubmissions = submissions
          .filter((submission) => submission.key)
          .map((submission) => ({
            submissionId: submission.id,
            participantId: submission.participantId,
            url: buildS3Url(submissionsBucketName, submission.key),
            thumbnailUrl: buildS3Url(
              thumbnailsBucketName,
              submission.thumbnailKey,
            ),
            previewUrl: buildS3Url(
              submissionsBucketName,
              submission.previewKey,
            ),
            topicId: submission.topicId,
            topicName: submission.topic?.name ?? "",
            isOwnSubmission:
              votingSession.connectedParticipantId !== null &&
              submission.participantId === votingSession.connectedParticipantId,
          }))

        return {
          alreadyVoted: false,
          votedAt: votingSession.votedAt,
          votedSubmissionId: votingSession.voteSubmissionId,
          submissions: votingSubmissions,
          sessionInfo: {
            token: votingSession.token,
            firstName: votingSession.firstName,
            lastName: votingSession.lastName,
            email: votingSession.email,
            startsAt: votingWindow.startsAt,
            endsAt: votingWindow.endsAt,
          },
        }
      })

      const submitVote = Effect.fn("VotingApiService.submitVote")(function* ({
        token,
        submissionId,
        domain,
      }: {
        token: string
        submissionId: number
        domain: string
      }) {
        const votingSessionResult =
          yield* db.votingQueries.getVotingSessionByToken({ token })

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        yield* ensureSessionDomain(votingSession, domain)

        if (votingSession.votedAt) {
          return {
            success: false as const,
            error: "already_voted" as const,
            votedAt: votingSession.votedAt,
          }
        }

        const votingWindow = yield* getTopicVotingWindow({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        yield* ensureVotingSessionWindow(votingWindow)

        const submission = yield* db.submissionsQueries.getSubmissionById({
          id: submissionId,
        })

        const resolvedSubmission = yield* Option.match(submission, {
          onSome: (resolvedSubmission) => {
            if (resolvedSubmission.marathonId !== votingSession.marathonId) {
              return Effect.fail(
                new VotingApiError({
                  message: "Submission does not belong to this marathon",
                }),
              )
            }

            if (resolvedSubmission.topicId !== votingSession.topicId) {
              return Effect.fail(
                new VotingApiError({
                  message: "Submission does not belong to this voting topic",
                }),
              )
            }

            return Effect.succeed(resolvedSubmission)
          },
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Submission not found",
              }),
            ),
        })

        if (
          votingSession.connectedParticipantId !== null &&
          resolvedSubmission.participantId ===
            votingSession.connectedParticipantId
        ) {
          return {
            success: false as const,
            error: "cannot_vote_for_self" as const,
          }
        }

        const updatedSession = yield* db.votingQueries.recordVote({
          token,
          submissionId,
        })

        if (!updatedSession) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to record vote",
            }),
          )
        }

        return {
          success: true as const,
          votedAt: updatedSession.votedAt,
          submissionId: updatedSession.voteSubmissionId,
        }
      })

      const clearVote = Effect.fn("VotingApiService.clearVote")(function* ({
        domain,
        topicId,
        sessionId,
      }: {
        domain: string
        topicId: number
        sessionId: number
      }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const sessionResult =
          yield* db.votingQueries.getVotingSessionByIdForTopic({
            marathonId: marathon.id,
            topicId,
            sessionId,
          })

        const session = yield* Option.match(sessionResult, {
          onSome: (s) => Effect.succeed(s),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        yield* ensureSessionDomain(session, domain)

        const updatedSession = yield* db.votingQueries.clearVote({
          sessionId,
        })

        if (!updatedSession) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to clear vote",
            }),
          )
        }

        return { success: true as const }
      })

      const deleteVotingSession = Effect.fn(
        "VotingApiService.deleteVotingSession",
      )(function* ({
        domain,
        topicId,
        sessionId,
      }: {
        domain: string
        topicId: number
        sessionId: number
      }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const sessionResult =
          yield* db.votingQueries.getVotingSessionByIdForTopic({
            marathonId: marathon.id,
            topicId,
            sessionId,
          })

        const session = yield* Option.match(sessionResult, {
          onSome: (s) => Effect.succeed(s),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        yield* ensureSessionDomain(session, domain)

        const deletedSession = yield* db.votingQueries.deleteVotingSession({
          sessionId,
        })

        if (!deletedSession) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to delete voting session",
            }),
          )
        }

        return { success: true as const }
      })

      return {
        getVotingSession,
        setTopicVotingWindow,
        closeTopicVotingWindow,
        startVotingSessions,
        getParticipantsWithoutVotingSession,
        startVotingSessionsForParticipants,
        getSubmissionVoteStats,
        createOrUpdateVotingSessionForParticipant,
        getVotingSessionByParticipant,
        getVotingAdminSummary,
        getVotingLeaderboardPage,
        getVotingVotersPage,
        createManualVotingSession,
        resendVotingSessionNotification,
        getVotingSubmissions,
        submitVote,
        clearVote,
        deleteVotingSession,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        Database.layer,
        SMSService.layer,
        PhoneNumberEncryptionService.layer,
      ),
    ),
  )
}
