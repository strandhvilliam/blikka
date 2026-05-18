import { Effect } from 'effect'
import type { Marathon, Topic } from '@blikka/db'

import { BadRequestError } from '../errors'

import { findActiveByCameraTopic } from '../shared'

export function ensureMarathonIsOpenForUploads({
  domain,
  marathon,
  activeTopic,
}: {
  domain: string
  marathon: Marathon & { topics?: readonly Topic[] }
  activeTopic?: Topic | null
}): Effect.Effect<void, BadRequestError> {
  if (!marathon.setupCompleted) {
    return Effect.fail(
      new BadRequestError({
        message: `[${domain}] Marathon setup is incomplete`,
      }),
    )
  }

  if (marathon.mode === 'marathon') {
    if (!marathon.startDate || !marathon.endDate) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Marathon upload window is not configured`,
        }),
      )
    }

    const startDate = new Date(marathon.startDate)
    const endDate = new Date(marathon.endDate)
    const now = new Date()

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Marathon upload window is invalid`,
        }),
      )
    }

    if (now < startDate || now > endDate) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Uploads are closed for this marathon`,
        }),
      )
    }
  }

  if (marathon.mode === 'by-camera') {
    const resolvedActiveTopic =
      activeTopic ?? findActiveByCameraTopic(marathon.topics ?? [])

    if (!resolvedActiveTopic) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] No active topic found for marathon`,
        }),
      )
    }

    if (resolvedActiveTopic.visibility !== 'active') {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Active topic is not active`,
        }),
      )
    }

    if (!resolvedActiveTopic.scheduledStart) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Active topic has not been opened for submissions`,
        }),
      )
    }

    if (new Date(resolvedActiveTopic.scheduledStart) > new Date()) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Submissions are scheduled to open later`,
        }),
      )
    }

    if (
      resolvedActiveTopic.scheduledEnd &&
      new Date(resolvedActiveTopic.scheduledEnd) <= new Date()
    ) {
      return Effect.fail(
        new BadRequestError({
          message: `[${domain}] Submissions are closed for this topic`,
        }),
      )
    }
  }

  return Effect.void
}
