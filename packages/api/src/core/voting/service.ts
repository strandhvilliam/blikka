import "server-only"

import { Config, Effect, Layer, Option, Context } from "effect"
import {
  DbLayer,
  VotingRepository,
  ParticipantsRepository,
  MarathonsRepository,
  SubmissionsRepository,
  type VotingRound,
  type VotingSession,
  type NewVotingSession,
} from "@blikka/db"
import { VotingApiError } from "./errors"
import { SMSService, SMSServiceLayer, SQSService, SQSServiceLayer } from "@blikka/aws"
import {
  EmailService,
  EmailServiceLayer,
  VotingInviteEmail,
  votingInviteEmailSubject,
} from "@blikka/email"
import {
  RealtimeEventsService,
  RealtimeEventsServiceLayer,
  getRealtimeChannelEnvironmentFromNodeEnv,
} from "@blikka/realtime"
import {
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
  type EncryptedPhoneNumber,
} from "../utils/phone-number-encryption"
import { randomBytes } from "crypto"
import {
  getVotingLifecycleState,
  hasSubmissionWindowEnded,
  parseVotingScheduleInput,
} from "./lifecycle"

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com"
const VOTING_SMS_CHUNK_SIZE = 30
const VOTING_SMS_ENQUEUE_CONCURRENCY = 10
const VOTING_EMAIL_BATCH_SIZE = 25

interface VotingSmsQueueMessage {
  votingSessionIds: number[]
  forceResend?: boolean
}

type NotificationWarning = {
  channel: "email" | "sms"
  message: string
  failedSessionIds: number[]
}

type VotingNotificationChannel = "email" | "sms" | "all"

function buildS3Url(bucketName: string, key: string | null | undefined): string | undefined {
  if (!key) return undefined
  return `${AWS_S3_BASE_URL}/${bucketName}/${key}`
}

function buildVotingInviteMessage({
  marathonName,
  domain,
  token,
}: {
  marathonName: string
  domain: string
  token: string
}) {
  return `Voting is starting for ${marathonName}! Vote here: ${buildVotingInviteUrl({ domain, token })}`
}

function buildVotingInviteUrl({ domain, token }: { domain: string; token: string }) {
  return `https://${domain}.blikka.app/live/vote/${token}`
}

function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim()
  return trimmed ? trimmed : null
}

function getParticipantDisplayName({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) {
  const fullName = `${firstName} ${lastName}`.trim()
  return firstName.trim() || fullName || "participant"
}

function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function parseVotingWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string
  endsAt?: string | null
}): Effect.Effect<{ startsAtIso: string; endsAtIso: string | null }, VotingApiError> {
  return Effect.try({
    try: () => parseVotingScheduleInput({ startsAt, endsAt }),
    catch: (error) =>
      new VotingApiError({
        message: error instanceof Error ? error.message : "Invalid voting timestamps",
        cause: error,
      }),
  })
}

function ensureSessionDomain(
  votingSession: VotingSession & { marathon?: { domain: string } | null },
  domain: string,
): Effect.Effect<void, VotingApiError> {
  if (votingSession.marathon?.domain && votingSession.marathon.domain !== domain) {
    return Effect.fail(
      new VotingApiError({
        message: "Voting session not found",
      }),
    )
  }

  return Effect.void
}

function getSessionDomain(
  votingSession: VotingSession & { marathon?: { domain: string } | null },
): Effect.Effect<string, VotingApiError> {
  const domain = votingSession.marathon?.domain

  if (!domain) {
    return Effect.fail(
      new VotingApiError({
        message: "Voting session not found",
      }),
    )
  }

  return Effect.succeed(domain)
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
  const normalizedLimit = Number.isInteger(limit) && limit && limit > 0 ? Math.min(limit, 100) : 50

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  }
}

function mapRoundSummary(round: VotingRound | null) {
  if (!round) {
    return null
  }

  return {
    id: round.id,
    roundNumber: round.roundNumber,
    kind: round.kind,
    startedAt: round.startedAt,
    endsAt: round.endsAt,
    sourceRoundId: round.sourceRoundId,
  }
}

function applyLatestRoundVoteToSession({
  votingSession,
  round,
  vote,
}: {
  votingSession: VotingSession & {
    marathon?: { domain: string } | null
    topic?: { name: string } | null
  }
  round: VotingRound | null
  vote: {
    submissionId: number
    votedAt: string
  } | null
}) {
  return {
    ...votingSession,
    voteSubmissionId: vote?.submissionId ?? null,
    votedAt: vote?.votedAt ?? null,
    currentRound: mapRoundSummary(round),
  }
}

export class VotingService extends Context.Service<VotingService>()(
  "@blikka/api/VotingService",
  {
    make: Effect.gen(function* () {
      const submissionsRepository = yield* SubmissionsRepository
      const marathonsRepository = yield* MarathonsRepository
      const participantsRepository = yield* ParticipantsRepository
      const votingRepository = yield* VotingRepository
      const smsService = yield* SMSService
      const emailService = yield* EmailService
      const sqs = yield* SQSService
      const realtimeEvents = yield* RealtimeEventsService
      const phoneEncryption = yield* PhoneNumberEncryptionService

      const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
      const thumbnailsBucketName = yield* Config.string("THUMBNAILS_BUCKET_NAME")
      const environment = yield* Config.string("NODE_ENV").pipe(
        Config.map(getRealtimeChannelEnvironmentFromNodeEnv),
      )
      const shouldSendVotingSms = environment === "prod"

      const enqueueVotingSmsNotifications = Effect.fn(
        "VotingService.enqueueVotingSmsNotifications",
      )(function* ({
        sessionIds,
        forceResend = false,
      }: {
        sessionIds: readonly number[]
        forceResend?: boolean
      }) {
        if (!shouldSendVotingSms) {
          return {
            smsChunksEnqueued: 0,
            smsSessionsQueued: 0,
            warning: null as NotificationWarning | null,
          }
        }

        const uniqueSessionIds = Array.from(new Set(sessionIds))
        if (uniqueSessionIds.length === 0) {
          return {
            smsChunksEnqueued: 0,
            smsSessionsQueued: 0,
            warning: null as NotificationWarning | null,
          }
        }

        const queueUrl = yield* Config.string("VOTING_SMS_QUEUE_URL")
        const queueChunks = chunkItems(uniqueSessionIds, VOTING_SMS_CHUNK_SIZE)

        const enqueueResult = yield* Effect.all(
          queueChunks.map((votingSessionIds) => {
            const message: VotingSmsQueueMessage = forceResend
              ? { votingSessionIds, forceResend: true }
              : { votingSessionIds }

            return sqs.sendMessage(queueUrl, JSON.stringify(message))
          }),
          { concurrency: VOTING_SMS_ENQUEUE_CONCURRENCY },
        ).pipe(
          Effect.as(null as NotificationWarning | null),
          Effect.catch((error) =>
            Effect.logError("Failed to enqueue voting invite SMS notifications", error).pipe(
              Effect.as({
                channel: "sms" as const,
                message: getErrorMessage(
                  error,
                  "Failed to enqueue voting invite SMS notifications",
                ),
                failedSessionIds: uniqueSessionIds,
              }),
            ),
          ),
        )

        return {
          smsChunksEnqueued: enqueueResult ? 0 : queueChunks.length,
          smsSessionsQueued: enqueueResult ? 0 : uniqueSessionIds.length,
          warning: enqueueResult,
        }
      })

      const updateNotificationTimestamp = Effect.fn("VotingService.updateNotificationTimestamp")(
        function* ({ sessionIds }: { sessionIds: readonly number[] }) {
          const uniqueSessionIds = Array.from(new Set(sessionIds))
          if (uniqueSessionIds.length === 0) {
            return null
          }

          const notificationLastSentAt = new Date().toISOString()
          yield* votingRepository.updateMultipleLastNotificationSentAt({
            ids: uniqueSessionIds,
            notificationLastSentAt,
          })

          return notificationLastSentAt
        },
      )

      const sendVotingInviteEmails = Effect.fn("VotingService.sendVotingInviteEmails")(
        function* ({
          marathonName,
          marathonLogoUrl,
          domain,
          topicName,
          sessions,
        }: {
          marathonName: string
          marathonLogoUrl?: string | null
          domain: string
          topicName?: string | null
          sessions: ReadonlyArray<{
            id: number
            email: string
            firstName: string
            lastName: string
            token: string
          }>
        }) {
          const emailSessions = sessions.flatMap((session) => {
            const email = normalizeEmail(session.email)
            return email
              ? [
                  {
                    ...session,
                    email,
                  },
                ]
              : []
          })

          if (emailSessions.length === 0) {
            return {
              sentSessionIds: [] as number[],
              warnings: [] as NotificationWarning[],
            }
          }

          const chunks = chunkItems(emailSessions, VOTING_EMAIL_BATCH_SIZE)
          const batchResults: Array<{
            sentSessionIds: number[]
            warning: NotificationWarning | null
          }> = yield* Effect.forEach(
            chunks,
            (chunk) => {
              const emails = chunk.map((session) => {
                const participantName = getParticipantDisplayName({
                  firstName: session.firstName,
                  lastName: session.lastName,
                })
                const votingUrl = buildVotingInviteUrl({
                  domain,
                  token: session.token,
                })

                return {
                  to: session.email,
                  subject: votingInviteEmailSubject({
                    participantName,
                    marathonName,
                    votingUrl,
                    marathonLogoUrl,
                    topicName,
                  }),
                  template: VotingInviteEmail({
                    participantName,
                    marathonName,
                    votingUrl,
                    marathonLogoUrl,
                    topicName,
                  }),
                  tags: [
                    { name: "category", value: "voting-invite" },
                    { name: "marathon", value: marathonName },
                  ],
                }
              })

              return emailService.sendBatch(emails).pipe(
                Effect.as({
                  sentSessionIds: chunk.map((session) => session.id),
                  warning: null,
                }),
                Effect.catch((error) =>
                  Effect.logError("Failed to send voting invite email batch", error).pipe(
                    Effect.as({
                      sentSessionIds: [] as number[],
                      warning: {
                        channel: "email" as const,
                        message: getErrorMessage(error, "Failed to send voting invite email batch"),
                        failedSessionIds: chunk.map((session) => session.id),
                      },
                    }),
                  ),
                ),
              )
            },
            { concurrency: 2 },
          )

          return {
            sentSessionIds: batchResults.flatMap((result) => result.sentSessionIds),
            warnings: batchResults.flatMap((result) => (result.warning ? [result.warning] : [])),
          }
        },
      )

      const sendVotingInviteNotification = Effect.fn(
        "VotingService.sendVotingInviteNotification",
      )(function* ({
        session,
        marathonName,
        marathonLogoUrl,
        domain,
        topicName,
        channel = "all",
      }: {
        session: {
          id: number
          email: string
          firstName: string
          lastName: string
          token: string
          phoneEncrypted: string | null
          notificationLastSentAt: string | null
        }
        marathonName: string
        marathonLogoUrl?: string | null
        domain: string
        topicName?: string | null
        channel?: VotingNotificationChannel
      }) {
        const email = normalizeEmail(session.email)
        const canSendEmail = (channel === "all" || channel === "email") && email !== null
        const canSendSms = (channel === "all" || channel === "sms") && !!session.phoneEncrypted

        if (!canSendEmail && !canSendSms) {
          const message =
            channel === "email"
              ? "This voter has no email address, so no email notification can be sent"
              : channel === "sms"
                ? "This voter has no phone number, so no phone notification can be sent"
                : "This voter has no email address or phone number, so no notification can be sent"

          return yield* Effect.fail(
            new VotingApiError({
              message,
            }),
          )
        }

        const participantName = getParticipantDisplayName({
          firstName: session.firstName,
          lastName: session.lastName,
        })
        const votingUrl = buildVotingInviteUrl({
          domain,
          token: session.token,
        })

        const emailResult = canSendEmail
          ? yield* emailService
              .send({
                to: email,
                subject: votingInviteEmailSubject({
                  participantName,
                  marathonName,
                  votingUrl,
                  marathonLogoUrl,
                  topicName,
                }),
                template: VotingInviteEmail({
                  participantName,
                  marathonName,
                  votingUrl,
                  marathonLogoUrl,
                  topicName,
                }),
                tags: [
                  { name: "category", value: "voting-invite" },
                  { name: "marathon", value: marathonName },
                ],
              })
              .pipe(
                Effect.as({ sent: true, error: null as string | null }),
                Effect.catch((error) =>
                  Effect.logError("Failed to send voting invite email", error).pipe(
                    Effect.as({
                      sent: false,
                      error: getErrorMessage(error, "Failed to send voting invite email"),
                    }),
                  ),
                ),
              )
          : { sent: false, error: null as string | null }

        const smsResult = canSendSms
          ? yield* phoneEncryption
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
                Effect.flatMap((phoneNumber) =>
                  smsService.sendWithOptOutCheck({
                    phoneNumber,
                    message: buildVotingInviteMessage({
                      marathonName,
                      domain,
                      token: session.token,
                    }),
                  }),
                ),
                Effect.as({ sent: true, error: null as string | null }),
                Effect.catch((error) =>
                  Effect.logError("Failed to send voting invite SMS", error).pipe(
                    Effect.as({
                      sent: false,
                      error: getErrorMessage(error, "Failed to send voting invite SMS"),
                    }),
                  ),
                ),
              )
          : { sent: false, error: null as string | null }

        const emailSent = emailResult.sent
        const smsSent = smsResult.sent

        const warningMessages = [
          ...(canSendEmail && emailResult.error
            ? [`Email was not sent: ${emailResult.error}`]
            : []),
          ...(canSendSms && smsResult.error ? [`SMS was not sent: ${smsResult.error}`] : []),
        ]

        if (!emailSent && !smsSent && warningMessages.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to send voting notification to this voter",
            }),
          )
        }

        const notificationLastSentAt =
          emailSent || smsSent
            ? yield* updateNotificationTimestamp({
                sessionIds: [session.id],
              })
            : session.notificationLastSentAt

        return {
          sessionId: session.id,
          notificationLastSentAt,
          emailSent,
          smsSent,
          emailError: emailResult.error,
          smsError: smsResult.error,
          warningMessages,
        }
      })

      const generateUniqueToken = Effect.fn("VotingService.generateUniqueToken")(function* ({
        usedTokens = new Set<string>(),
      }: { usedTokens?: Set<string> } = {}) {
        while (true) {
          const token = randomBytes(8).toString("base64url").slice(0, 8)
          if (usedTokens.has(token)) {
            continue
          }
          const existing = yield* votingRepository.getVotingSessionByToken({
            token,
          })
          if (Option.isNone(existing)) {
            usedTokens.add(token)
            return token
          }
        }
      })

      const getByCameraMarathonWithTopic = Effect.fn(
        "VotingService.getByCameraMarathonWithTopic",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const marathonOpt = yield* marathonsRepository.getMarathonByDomainWithOptions({
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
          activeTopic: marathon.topics.find((item) => item.visibility === "active") ?? null,
        }
      })

      const getTopicVotingWindow = Effect.fn("VotingService.getTopicVotingWindow")(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const votingWindow = yield* votingRepository.getVotingWindowForTopic({
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

      const getLatestVotingRoundForTopic = Effect.fn(
        "VotingService.getLatestVotingRoundForTopic",
      )(function* ({ marathonId, topicId }: { marathonId: number; topicId: number }) {
        const roundOpt = yield* votingRepository.getLatestVotingRoundForTopic({
          marathonId,
          topicId,
        })

        return Option.getOrUndefined(roundOpt) ?? null
      })

      const getActiveVotingRoundForTopic = Effect.fn(
        "VotingService.getActiveVotingRoundForTopic",
      )(function* ({ marathonId, topicId }: { marathonId: number; topicId: number }) {
        const roundOpt = yield* votingRepository.getActiveVotingRoundForTopic({
          marathonId,
          topicId,
        })

        return Option.getOrUndefined(roundOpt) ?? null
      })

      const getVotingSession = Effect.fn("VotingService.getVotingSession")(function* ({
        token,
      }: {
        token: string
      }) {
        const votingSessionResult = yield* votingRepository.getVotingSessionByToken({ token })

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        const votingWindow = yield* getTopicVotingWindow({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })
        const latestVote = latestRound
          ? yield* votingRepository.getVotingRoundVoteForSession({
              roundId: latestRound.id,
              sessionId: votingSession.id,
            })
          : Option.none()
        const latestVoteValue = Option.getOrUndefined(latestVote) ?? null

        const sessionWithLatestRound = applyLatestRoundVoteToSession({
          votingSession,
          round: latestRound,
          vote: latestVoteValue
            ? {
                submissionId: latestVoteValue.submissionId,
                votedAt: latestVoteValue.votedAt,
              }
            : null,
        })

        return {
          ...sessionWithLatestRound,
          startsAt: votingWindow.startsAt,
          endsAt: votingWindow.endsAt,
        }
      })

      const setTopicVotingWindow = Effect.fn("VotingService.setTopicVotingWindow")(function* ({
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

        const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting window can only be configured for the active by-camera topic",
            }),
          )
        }

        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: marathon.id,
          topicId,
        })

        if (!latestRound) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No voting round found for this topic",
            }),
          )
        }

        const window = yield* votingRepository.upsertTopicVotingWindow({
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

      const closeTopicVotingWindow = Effect.fn("VotingService.closeTopicVotingWindow")(
        function* ({ domain, topicId }: { domain: string; topicId: number }) {
          const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

          if (!activeTopic || activeTopic.id !== topic.id) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Voting window can only be closed for the active by-camera topic",
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
          const latestRound = yield* getLatestVotingRoundForTopic({
            marathonId: marathon.id,
            topicId,
          })

          if (!latestRound) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "No voting round found for this topic",
              }),
            )
          }

          const updatedWindow = yield* votingRepository.closeTopicVotingWindow({
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
        },
      )

      const reopenTopicVotingWindow = Effect.fn("VotingService.reopenTopicVotingWindow")(
        function* ({ domain, topicId }: { domain: string; topicId: number }) {
          const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

          if (!activeTopic || activeTopic.id !== topic.id) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Voting window can only be reopened for the active by-camera topic",
              }),
            )
          }

          const votingWindow = yield* getTopicVotingWindow({
            marathonId: marathon.id,
            topicId,
          })

          const votingState = getVotingLifecycleState(votingWindow)
          if (votingState !== "ended") {
            return yield* Effect.fail(
              new VotingApiError({
                message:
                  votingState === "active"
                    ? "Voting is still open for this topic"
                    : "Voting has not started for this topic",
              }),
            )
          }

          const nowIso = new Date().toISOString()
          const latestRound = yield* getLatestVotingRoundForTopic({
            marathonId: marathon.id,
            topicId,
          })

          if (!latestRound) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "No voting round found for this topic",
              }),
            )
          }

          const updatedWindow = yield* votingRepository.reopenTopicVotingWindow({
            marathonId: marathon.id,
            topicId,
            nowIso,
          })

          if (!updatedWindow) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Failed to reopen voting window",
              }),
            )
          }

          return {
            topicId,
            startsAt: updatedWindow.startsAt,
            endsAt: updatedWindow.endsAt,
          }
        },
      )

      const startTiebreakRound = Effect.fn("VotingService.startTiebreakRound")(function* ({
        domain,
        topicId,
        endsAt,
      }: {
        domain: string
        topicId: number
        endsAt?: string | null
      }) {
        const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Tie-break voting can only be started for the active by-camera topic",
            }),
          )
        }

        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: marathon.id,
          topicId,
        })

        if (!latestRound) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No completed voting round exists for this topic",
            }),
          )
        }

        if (!latestRound.endsAt) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "The latest voting round is still open",
            }),
          )
        }

        const leadingTieOpt = yield* votingRepository.getLeadingTieForTopic({
          marathonId: marathon.id,
          topicId,
        })
        const leadingTie = Option.getOrUndefined(leadingTieOpt)

        if (!leadingTie) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No lead tie exists for the latest voting round",
            }),
          )
        }

        const nowIso = new Date().toISOString()
        const { startsAtIso, endsAtIso } = yield* parseVotingWindow({
          startsAt: nowIso,
          endsAt,
        })

        const createdRound = yield* votingRepository.createVotingRound({
          marathonId: marathon.id,
          topicId,
          roundNumber: latestRound.roundNumber + 1,
          kind: "tiebreak",
          sourceRoundId: latestRound.id,
          startedAt: startsAtIso,
          endsAt: endsAtIso,
        })

        const resolvedRound =
          createdRound ??
          Option.getOrUndefined(
            yield* votingRepository.getLatestVotingRoundForTopic({
              marathonId: marathon.id,
              topicId,
            }),
          )

        if (
          !resolvedRound ||
          resolvedRound.roundNumber !== latestRound.roundNumber + 1 ||
          resolvedRound.kind !== "tiebreak"
        ) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to create a tie-break round",
            }),
          )
        }

        yield* votingRepository.createVotingRoundSubmissions({
          roundId: resolvedRound.id,
          submissionIds: leadingTie.submissionIds,
        })

        return {
          topicId,
          votingWindow: {
            startsAt: resolvedRound.startedAt,
            endsAt: resolvedRound.endsAt,
          },
          round: mapRoundSummary(resolvedRound),
          eligibleSubmissionCount: leadingTie.submissionIds.length,
          tieSize: leadingTie.tieSize,
        }
      })

      const startVotingSessions = Effect.fn("VotingService.startVotingSessions")(function* ({
        domain,
        topicId,
        endsAt,
        sendInitialSms,
      }: {
        domain: string
        topicId: number
        endsAt?: string | null
        sendInitialSms?: boolean
      }) {
        const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting can only be started for the active by-camera topic",
            }),
          )
        }

        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: marathon.id,
          topicId,
        })

        if (latestRound) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting has already been started for this topic",
            }),
          )
        }

        if (!hasSubmissionWindowEnded(topic.scheduledEnd)) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting cannot start until submissions have ended for the active topic",
            }),
          )
        }

        const nowIso = new Date().toISOString()
        const { startsAtIso, endsAtIso } = yield* parseVotingWindow({
          startsAt: nowIso,
          endsAt,
        })
        const participantsWithSubmissions =
          yield* votingRepository.getParticipantsWithSubmissionsByTopicId({
            marathonId: marathon.id,
            topicId,
          })

        if (participantsWithSubmissions.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No participants with submissions found for this topic",
            }),
          )
        }

        const submissionIds = Array.from(
          new Set(
            participantsWithSubmissions.flatMap((participant) =>
              participant.submissions.map((submission) => submission.id),
            ),
          ),
        )

        const existingCount = yield* votingRepository.countVotingSessionsForTopic({
          marathonId: marathon.id,
          topicId,
        })

        const participantsWithoutSession =
          yield* votingRepository.getParticipantsWithSubmissionsButNoVotingSession({
            marathonId: marathon.id,
            topicId,
          })

        const createdRound = yield* votingRepository.createVotingRound({
          marathonId: marathon.id,
          topicId,
          roundNumber: 1,
          kind: "initial",
          sourceRoundId: null,
          startedAt: startsAtIso,
          endsAt: endsAtIso,
        })

        const resolvedRound =
          createdRound ??
          Option.getOrUndefined(
            yield* votingRepository.getLatestVotingRoundForTopic({
              marathonId: marathon.id,
              topicId,
            }),
          )

        if (!resolvedRound || resolvedRound.roundNumber !== 1 || resolvedRound.kind !== "initial") {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to create voting round for this topic",
            }),
          )
        }

        yield* votingRepository.createVotingRoundSubmissions({
          roundId: resolvedRound.id,
          submissionIds,
        })

        const fullParticipants = yield* Effect.all(
          participantsWithoutSession.map((participant) =>
            participantsRepository.getParticipantById({ id: participant.id }),
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

        const createdSessions = yield* votingRepository.createVotingSessions({
          sessions: sessionsToCreate,
        })
        const { sentSessionIds, warnings: emailWarnings } = yield* sendVotingInviteEmails({
          marathonName: marathon.name,
          marathonLogoUrl: marathon.logoUrl,
          domain,
          topicName: topic.name,
          sessions: createdSessions.map((session) => ({
            id: session.id,
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            token: session.token,
          })),
        })

        yield* updateNotificationTimestamp({
          sessionIds: sentSessionIds,
        })

        const {
          smsChunksEnqueued,
          smsSessionsQueued,
          warning: smsWarning,
        } = sendInitialSms === false
          ? {
              smsChunksEnqueued: 0,
              smsSessionsQueued: 0,
              warning: null as NotificationWarning | null,
            }
          : yield* enqueueVotingSmsNotifications({
              sessionIds: createdSessions
                .filter((session) => session.phoneEncrypted)
                .map((session) => session.id),
            })

        return {
          topicId,
          votingWindow: {
            startsAt: resolvedRound.startedAt,
            endsAt: resolvedRound.endsAt,
          },
          sessionsCreated: createdSessions.length,
          smsSent: 0,
          smsResults: [],
          smsChunksEnqueued,
          smsSessionsQueued,
          existingSessions: existingCount,
          notificationWarnings: smsWarning ? [...emailWarnings, smsWarning] : emailWarnings,
        }
      })

      const getParticipantsWithoutVotingSession = Effect.fn(
        "VotingService.getParticipantsWithoutVotingSession",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const { marathon } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const existingCount = yield* votingRepository.countVotingSessionsForTopic({
          marathonId: marathon.id,
          topicId,
        })

        if (existingCount === 0) {
          return []
        }

        return yield* votingRepository.getParticipantsWithSubmissionsButNoVotingSession({
          marathonId: marathon.id,
          topicId,
        })
      })

      const startVotingSessionsForParticipants = Effect.fn(
        "VotingService.startVotingSessionsForParticipants",
      )(function* ({
        domain,
        topicId,
        participantIds,
      }: {
        domain: string
        topicId: number
        participantIds: readonly number[]
      }) {
        const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        if (!activeTopic || activeTopic.id !== topic.id) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting can only be started for the active by-camera topic",
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
          yield* votingRepository.getParticipantsWithSubmissionsButNoVotingSession({
            marathonId: marathon.id,
            topicId,
          })

        const validParticipantIds = new Set(participantsWithSubmissions.map((p) => p.id))
        const idsToProcess = participantIds.filter((id) => validParticipantIds.has(id))

        if (idsToProcess.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "None of the provided participants are eligible (they may already have sessions or no submissions for this topic)",
            }),
          )
        }

        const fullParticipants = yield* Effect.all(
          idsToProcess.map((id) => participantsRepository.getParticipantById({ id })),
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

        const createdSessions = yield* votingRepository.createVotingSessions({
          sessions: sessionsToCreate,
        })
        const { sentSessionIds, warnings: emailWarnings } = yield* sendVotingInviteEmails({
          marathonName: marathon.name,
          marathonLogoUrl: marathon.logoUrl,
          domain,
          topicName: topic.name,
          sessions: createdSessions.map((session) => ({
            id: session.id,
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            token: session.token,
          })),
        })

        yield* updateNotificationTimestamp({
          sessionIds: sentSessionIds,
        })

        const {
          smsChunksEnqueued,
          smsSessionsQueued,
          warning: smsWarning,
        } = yield* enqueueVotingSmsNotifications({
          sessionIds: createdSessions
            .filter((session) => session.phoneEncrypted)
            .map((session) => session.id),
        })

        return {
          topicId,
          votingWindow,
          sessionsCreated: createdSessions.length,
          smsSent: 0,
          smsResults: [],
          smsChunksEnqueued,
          smsSessionsQueued,
          notificationWarnings: smsWarning ? [...emailWarnings, smsWarning] : emailWarnings,
        }
      })

      const getSubmissionVoteStats = Effect.fn("VotingService.getSubmissionVoteStats")(
        function* ({ submissionId, domain }: { submissionId: number; domain: string }) {
          const statsResult = yield* votingRepository.getSubmissionVoteStats({
            submissionId,
            domain,
          })

          if (Option.isNone(statsResult)) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Failed to get vote stats",
              }),
            )
          }

          const stats = statsResult.value

          const submission = yield* submissionsRepository.getSubmissionById({
            id: submissionId,
          })

          let participantVoteInfo = null
          if (Option.isSome(submission)) {
            const participantId = submission.value.participantId
            const voteInfoResult = yield* votingRepository.getParticipantVoteInfo({
              participantId,
              topicId: submission.value.topicId,
            })

            if (Option.isSome(voteInfoResult)) {
              participantVoteInfo = voteInfoResult.value
            }
          }

          return {
            ...stats,
            participantVoteInfo,
          }
        },
      )

      const createOrUpdateVotingSessionForParticipant = Effect.fn(
        "VotingService.createOrUpdateVotingSessionForParticipant",
      )(function* ({
        participantId,
        domain,
        topicId,
      }: {
        participantId: number
        domain: string
        topicId: number
      }) {
        const marathonOpt = yield* marathonsRepository.getMarathonByDomainWithOptions({
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

        const participantOpt = yield* participantsRepository.getParticipantById({
          id: participantId,
        })

        const participant = yield* Option.match(participantOpt, {
          onSome: (p) => Effect.succeed(p),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Participant not found with id ${participantId}`,
              }),
            ),
        })

        const submissions = yield* submissionsRepository.getSubmissionsByParticipantId({
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

        const existingSessionOpt = yield* votingRepository.getVotingSessionByParticipantAndTopicId({
          participantId,
          topicId,
        })
        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: marathon.id,
          topicId,
        })

        if (Option.isSome(existingSessionOpt)) {
          const existingSession = existingSessionOpt.value
          const latestRoundVote = latestRound
            ? yield* votingRepository.getVotingRoundVoteForSession({
                roundId: latestRound.id,
                sessionId: existingSession.id,
              })
            : Option.none()

          if (Option.isSome(latestRoundVote)) {
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
          notificationLastSentAt: Option.isSome(existingSessionOpt)
            ? existingSessionOpt.value.notificationLastSentAt
            : null,
          topicId,
        }

        const session = yield* votingRepository.upsertVotingSession(sessionData)

        let smsResult = null
        if (session.phoneEncrypted && shouldSendVotingSms) {
          const smsResult_ = yield* Effect.gen(function* () {
            const phoneNumber = yield* phoneEncryption.decrypt({
              encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
            })

            const message = buildVotingInviteMessage({
              marathonName: marathon.name,
              domain,
              token: session.token,
            })

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

        const notificationLastSentAt =
          smsResult && !("error" in smsResult) ? nowIso : session.notificationLastSentAt

        if (notificationLastSentAt !== session.notificationLastSentAt) {
          yield* votingRepository.updateMultipleLastNotificationSentAt({
            ids: [session.id],
            notificationLastSentAt,
          })
        }

        const action = Option.isSome(existingSessionOpt) ? "resent" : "created"

        return {
          action,
          session: {
            ...session,
            notificationLastSentAt,
          },
          smsSent: smsResult !== null && !("error" in smsResult),
          smsError: smsResult && "error" in smsResult ? smsResult.error : null,
        }
      })

      const getVotingSessionByParticipant = Effect.fn(
        "VotingService.getVotingSessionByParticipant",
      )(function* ({ participantId, topicId }: { participantId: number; topicId: number }) {
        const sessionOpt = yield* votingRepository.getVotingSessionByParticipantAndTopicId({
          participantId,
          topicId,
        })
        const session = Option.getOrUndefined(sessionOpt)
        const latestRound = session
          ? yield* getLatestVotingRoundForTopic({
              marathonId: session.marathonId,
              topicId,
            })
          : null
        const latestVote =
          session && latestRound
            ? yield* votingRepository.getVotingRoundVoteForSession({
                roundId: latestRound.id,
                sessionId: session.id,
              })
            : Option.none()

        return Option.match(sessionOpt, {
          onSome: (session) => ({
            hasSession: true as const,
            session,
            hasVoted: Option.isSome(latestVote),
            notificationLastSentAt: session.notificationLastSentAt,
          }),
          onNone: () => ({
            hasSession: false as const,
          }),
        })
      })

      const getVotingAdminSummary = Effect.fn("VotingService.getVotingAdminSummary")(function* ({
        domain,
        topicId,
      }: {
        domain: string
        topicId: number
      }) {
        const { marathon, topic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const [
          sessionStatsResult,
          votingWindowResult,
          latestRound,
          leadingTieOpt,
          submissionCount,
          eligibleSubmissionCount,
          participantWithSubmissionCount,
          topRankRows,
        ] = yield* Effect.all([
          votingRepository.getVotingSessionStatsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          votingRepository.getVotingWindowForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          getLatestVotingRoundForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          votingRepository.getLeadingTieForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          votingRepository.countSubmissionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          votingRepository.countVotingRoundSubmissionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          votingRepository.countParticipantsWithSubmissionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
          votingRepository.getTopRanksPreviewForTopic({
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

        const pendingSessions = sessionStatsResult.total - sessionStatsResult.completed
        const leadingTie = Option.getOrUndefined(leadingTieOpt) ?? null
        const canStartTiebreak =
          !!latestRound && !!latestRound.endsAt && !!leadingTie && leadingTie.tieSize > 1

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
            eligibleSubmissionCount,
            participantWithSubmissionCount,
          },
          currentRound: mapRoundSummary(latestRound),
          leadingTie,
          canStartTiebreak,
          topRanks,
        }
      })

      const getVotingRoundsForTopic = Effect.fn("VotingService.getVotingRoundsForTopic")(
        function* ({ domain, topicId }: { domain: string; topicId: number }) {
          const { marathon } = yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })
          return yield* votingRepository.getVotingRoundsForTopic({
            marathonId: marathon.id,
            topicId,
          })
        },
      )

      const getVotingLeaderboardPage = Effect.fn("VotingService.getVotingLeaderboardPage")(
        function* ({
          domain,
          topicId,
          page,
          limit,
          roundId,
        }: {
          domain: string
          topicId: number
          page?: number | null
          limit?: number | null
          roundId?: number
        }) {
          const { marathon } = yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })
          const { page: normalizedPage, limit: normalizedLimit } = normalizePaginationInput({
            page,
            limit,
          })

          if (roundId != null) {
            const roundOpt = yield* votingRepository.getVotingRoundById({
              marathonId: marathon.id,
              topicId,
              roundId,
            })
            if (Option.isNone(roundOpt)) {
              return yield* Effect.fail(new VotingApiError({ message: "Voting round not found" }))
            }
          }

          const roundIdForQuery = roundId ?? null

          const [items, total] = yield* Effect.all([
            votingRepository.getLeaderboardPageForTopic({
              marathonId: marathon.id,
              topicId,
              page: normalizedPage,
              limit: normalizedLimit,
              roundId: roundIdForQuery,
            }),
            votingRepository.countVotingRoundSubmissionsForTopic({
              marathonId: marathon.id,
              topicId,
              roundId: roundIdForQuery,
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
        },
      )

      const getVotingVotersPage = Effect.fn("VotingService.getVotingVotersPage")(function* ({
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
        const { page: normalizedPage, limit: normalizedLimit } = normalizePaginationInput({
          page,
          limit,
        })

        const [sessions, total] = yield* Effect.all([
          votingRepository.getVotersPageForTopic({
            marathonId: marathon.id,
            topicId,
            page: normalizedPage,
            limit: normalizedLimit,
          }),
          votingRepository.countVotingSessionsForTopic({
            marathonId: marathon.id,
            topicId,
          }),
        ])

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
                voteSubmission: session.voteSubmissionId
                  ? {
                      submissionId: session.voteSubmissionId,
                      participantReference: session.voteParticipantReference ?? null,
                      participantFirstName: session.voteParticipantFirstName ?? null,
                      participantLastName: session.voteParticipantLastName ?? null,
                      thumbnailKey: session.voteSubmissionThumbnailKey,
                      key: session.voteSubmissionKey,
                      createdAt: session.voteSubmissionCreatedAt,
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

      const createManualVotingSession = Effect.fn("VotingService.createManualVotingSession")(
        function* ({
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

          const { marathon, topic, activeTopic } = yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })
          if (!activeTopic || activeTopic.id !== topic.id) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Manual invites are only allowed on the active by-camera topic",
              }),
            )
          }
          const votingWindow = yield* getTopicVotingWindow({
            marathonId: marathon.id,
            topicId,
          })

          yield* ensureVotingSessionWindow(votingWindow)

          const created = yield* votingRepository.createVotingSessions({
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
        },
      )

      const resendVotingSessionNotification = Effect.fn(
        "VotingService.resendVotingSessionNotification",
      )(function* ({
        domain,
        topicId,
        sessionId,
        channel,
      }: {
        domain: string
        topicId: number
        sessionId: number
        channel?: "email" | "sms"
      }) {
        const { marathon, topic } = yield* getByCameraMarathonWithTopic({
          domain,
          topicId,
        })

        const sessionOpt = yield* votingRepository.getVotingSessionByIdForTopic({
          marathonId: marathon.id,
          topicId,
          sessionId,
        })
        const session = yield* Option.match(sessionOpt, {
          onSome: (s) => Effect.succeed(s),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found for the selected topic",
              }),
            ),
        })

        return yield* sendVotingInviteNotification({
          session: {
            id: session.id,
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            token: session.token,
            phoneEncrypted: session.phoneEncrypted,
            notificationLastSentAt: session.notificationLastSentAt,
          },
          marathonName: marathon.name,
          marathonLogoUrl: marathon.logoUrl,
          domain,
          topicName: topic.name,
          channel: channel ?? "all",
        })
      })

      const updateVotingSessionContact = Effect.fn("VotingService.updateVotingSessionContact")(
        function* ({
          domain,
          topicId,
          sessionId,
          email,
          phoneNumber,
        }: {
          domain: string
          topicId: number
          sessionId: number
          email?: string
          phoneNumber?: string
        }) {
          if (email === undefined && phoneNumber === undefined) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Provide an email or phone number to update",
              }),
            )
          }

          const { marathon } = yield* getByCameraMarathonWithTopic({
            domain,
            topicId,
          })

          const sessionOpt = yield* votingRepository.getVotingSessionByIdForTopic({
            marathonId: marathon.id,
            topicId,
            sessionId,
          })
          const session = yield* Option.match(sessionOpt, {
            onSome: (s) => Effect.succeed(s),
            onNone: () =>
              Effect.fail(
                new VotingApiError({
                  message: "Voting session not found for the selected topic",
                }),
              ),
          })

          yield* ensureSessionDomain(session, domain)

          const patch: {
            email?: string
            phoneHash?: string | null
            phoneEncrypted?: string | null
          } = {}

          if (email !== undefined) {
            patch.email = normalizeEmail(email) ?? ""
          }

          if (phoneNumber !== undefined) {
            const trimmed = phoneNumber.trim()
            if (!trimmed) {
              patch.phoneHash = null
              patch.phoneEncrypted = null
            } else {
              const encryptedPayload = yield* phoneEncryption
                .encrypt({ phoneNumber: trimmed })
                .pipe(
                  Effect.mapError(
                    (error) =>
                      new VotingApiError({
                        message: error.message,
                      }),
                  ),
                )
              patch.phoneHash = encryptedPayload.hash
              patch.phoneEncrypted = encryptedPayload.encrypted
            }
          }

          const updated = yield* votingRepository.updateVotingSessionContact({
            marathonId: marathon.id,
            topicId,
            sessionId,
            patch,
          })

          if (!updated) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Failed to update voting session",
              }),
            )
          }

          const phoneNumberPlain = updated.phoneEncrypted
            ? yield* phoneEncryption
                .decrypt({
                  encrypted: updated.phoneEncrypted as EncryptedPhoneNumber,
                })
                .pipe(Effect.catch(() => Effect.succeed(null as string | null)))
            : null

          return {
            sessionId: updated.id,
            email: updated.email,
            phoneNumber: phoneNumberPlain,
          }
        },
      )

      const getVotingSubmissions = Effect.fn("VotingService.getVotingSubmissions")(function* ({
        token,
      }: {
        token: string
      }) {
        const votingSessionResult = yield* votingRepository.getVotingSessionByToken({ token })

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        const votingWindow = yield* getTopicVotingWindow({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })
        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })
        const latestRoundVote = latestRound
          ? yield* votingRepository.getVotingRoundVoteForSession({
              roundId: latestRound.id,
              sessionId: votingSession.id,
            })
          : Option.none()
        const latestRoundVoteValue = Option.getOrUndefined(latestRoundVote) ?? null

        if (latestRound && latestRoundVoteValue) {
          return {
            alreadyVoted: true,
            votedAt: latestRoundVoteValue.votedAt,
            votedSubmissionId: latestRoundVoteValue.submissionId,
            submissions: [],
            sessionInfo: {
              token: votingSession.token,
              firstName: votingSession.firstName,
              lastName: votingSession.lastName,
              email: votingSession.email,
              startsAt: votingWindow.startsAt,
              endsAt: votingWindow.endsAt,
              currentRound: mapRoundSummary(latestRound),
            },
          }
        }

        yield* ensureVotingSessionWindow(votingWindow)
        const activeRound = yield* getActiveVotingRoundForTopic({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        if (!activeRound) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No active voting round found",
            }),
          )
        }

        const submissions = yield* votingRepository.getSubmissionsForVoting({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
          roundId: activeRound.id,
        })

        const votingSubmissions = submissions
          .filter((submission) => submission.key)
          .map((submission) => ({
            submissionId: submission.id,
            participantId: submission.participantId,
            url: buildS3Url(submissionsBucketName, submission.key),
            thumbnailUrl: buildS3Url(thumbnailsBucketName, submission.thumbnailKey),
            previewUrl: buildS3Url(submissionsBucketName, submission.previewKey),
            topicId: submission.topicId,
            topicName: submission.topic?.name ?? "",
            isOwnSubmission:
              votingSession.connectedParticipantId !== null &&
              submission.participantId === votingSession.connectedParticipantId,
          }))

        return {
          alreadyVoted: false,
          votedAt: null,
          votedSubmissionId: null,
          submissions: votingSubmissions,
          sessionInfo: {
            token: votingSession.token,
            firstName: votingSession.firstName,
            lastName: votingSession.lastName,
            email: votingSession.email,
            startsAt: votingWindow.startsAt,
            endsAt: votingWindow.endsAt,
            currentRound: mapRoundSummary(activeRound),
          },
        }
      })

      const submitVote = Effect.fn("VotingService.submitVote")(function* ({
        token,
        submissionId,
      }: {
        token: string
        submissionId: number
      }) {
        const votingSessionResult = yield* votingRepository.getVotingSessionByToken({ token })

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        })

        const domain = yield* getSessionDomain(votingSession)

        const votingWindow = yield* getTopicVotingWindow({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        yield* ensureVotingSessionWindow(votingWindow)
        const activeRound = yield* getActiveVotingRoundForTopic({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        })

        if (!activeRound) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No active voting round found",
            }),
          )
        }

        const existingVote = yield* votingRepository.getVotingRoundVoteForSession({
          roundId: activeRound.id,
          sessionId: votingSession.id,
        })

        if (Option.isSome(existingVote)) {
          return {
            success: false as const,
            error: "already_voted" as const,
            votedAt: existingVote.value.votedAt,
          }
        }

        const submission = yield* submissionsRepository.getSubmissionById({
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

        const roundSubmissions = yield* votingRepository.getSubmissionsForVoting({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
          roundId: activeRound.id,
        })

        if (
          !roundSubmissions.some(
            (eligibleSubmission) => eligibleSubmission.id === resolvedSubmission.id,
          )
        ) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Submission is not eligible in the active voting round",
            }),
          )
        }

        if (
          votingSession.connectedParticipantId !== null &&
          resolvedSubmission.participantId === votingSession.connectedParticipantId
        ) {
          return {
            success: false as const,
            error: "cannot_vote_for_self" as const,
          }
        }

        const recordedVote = yield* votingRepository.recordVote({
          roundId: activeRound.id,
          sessionId: votingSession.id,
          submissionId,
        })

        if (!recordedVote) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to record vote",
            }),
          )
        }

        const voteRealtimePayloadResult =
          yield* submissionsRepository.getSubmissionVoteRealtimePayloadById({
            id: submissionId,
          })

        yield* Option.match(voteRealtimePayloadResult, {
          onSome: (voteRealtimePayload) =>
            realtimeEvents
              .emitVotingVoteCast({
                environment,
                domain,
                topicId: votingSession.topicId,
                sessionId: votingSession.id,
                submissionId,
                votedAt: recordedVote.votedAt,
                participantReference: voteRealtimePayload.participantReference,
                participantFirstName: voteRealtimePayload.participantFirstName,
                participantLastName: voteRealtimePayload.participantLastName,
                submissionCreatedAt: voteRealtimePayload.submissionCreatedAt,
                submissionKey: voteRealtimePayload.submissionKey,
                submissionThumbnailKey: voteRealtimePayload.submissionThumbnailKey,
              })
              .pipe(
                Effect.catch((error) =>
                  Effect.logWarning(
                    `[VotingService.submitVote] Failed to publish realtime vote update for ${domain}:${votingSession.topicId}:${votingSession.id} - ${error.message}`,
                  ),
                ),
              ),
          onNone: () =>
            Effect.logWarning(
              `[VotingService.submitVote] Skipped realtime vote update for ${domain}:${votingSession.topicId}:${votingSession.id} because the payload could not be loaded`,
            ),
        })

        return {
          success: true as const,
          votedAt: recordedVote.votedAt,
          submissionId: recordedVote.submissionId,
          roundId: activeRound.id,
        }
      })

      const clearVote = Effect.fn("VotingService.clearVote")(function* ({
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

        const sessionResult = yield* votingRepository.getVotingSessionByIdForTopic({
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
        const latestRound = yield* getLatestVotingRoundForTopic({
          marathonId: marathon.id,
          topicId,
        })

        if (!latestRound) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No voting round found for this topic",
            }),
          )
        }

        const deletedVote = yield* votingRepository.clearVote({
          roundId: latestRound.id,
          sessionId,
        })

        if (!deletedVote) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to clear vote",
            }),
          )
        }

        return { success: true as const }
      })

      const deleteVotingSession = Effect.fn("VotingService.deleteVotingSession")(function* ({
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

        const sessionResult = yield* votingRepository.getVotingSessionByIdForTopic({
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

        const deletedSession = yield* votingRepository.deleteVotingSession({
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
        reopenTopicVotingWindow,
        startTiebreakRound,
        startVotingSessions,
        getParticipantsWithoutVotingSession,
        startVotingSessionsForParticipants,
        getSubmissionVoteStats,
        createOrUpdateVotingSessionForParticipant,
        getVotingSessionByParticipant,
        getVotingAdminSummary,
        getVotingRoundsForTopic,
        getVotingLeaderboardPage,
        getVotingVotersPage,
        createManualVotingSession,
        resendVotingSessionNotification,
        updateVotingSessionContact,
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
        DbLayer,
        SMSServiceLayer,
        EmailServiceLayer,
        SQSServiceLayer,
        RealtimeEventsServiceLayer,
        PhoneNumberEncryptionServiceLayer,
      ),
    ),
  )
}
