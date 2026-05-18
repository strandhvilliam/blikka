import { Effect } from 'effect'
import type { Marathon, Topic } from '@blikka/db'

import { BadRequestError, NotFoundError } from '../errors'

/** First topic with `visibility === 'active'`, if any. */
export function findActiveByCameraTopic(topics: readonly Topic[]): Topic | null {
  return topics.find((topic) => topic.visibility === 'active') ?? null
}

export function requireByCameraMode(
  marathon: Pick<Marathon, 'mode' | 'domain'>,
  options?: { messagePrefix?: string },
): Effect.Effect<void, BadRequestError> {
  if (marathon.mode !== 'by-camera') {
    const prefix = options?.messagePrefix
    const message = prefix
      ? `${prefix} Marathon '${marathon.domain}' is not in by-camera mode`
      : `Marathon '${marathon.domain}' is not in by-camera mode`

    return Effect.fail(new BadRequestError({ message }))
  }

  return Effect.void
}

export function requireMarathonMode(
  marathon: Pick<Marathon, 'mode' | 'domain'>,
  mode: Marathon['mode'],
  message: string,
): Effect.Effect<void, BadRequestError> {
  if (marathon.mode !== mode) {
    return Effect.fail(
      new BadRequestError({
        message: message.replace('{domain}', marathon.domain),
      }),
    )
  }

  return Effect.void
}

export function getActiveByCameraTopicOrBadRequest({
  domain,
  topics,
}: {
  domain: string
  topics: readonly Topic[]
}): Effect.Effect<Topic, BadRequestError> {
  const activeTopic = findActiveByCameraTopic(topics)

  if (!activeTopic) {
    return Effect.fail(
      new BadRequestError({
        message: `[${domain}] No active topic found for marathon`,
      }),
    )
  }

  return Effect.succeed(activeTopic)
}

export function getActiveByCameraTopicOrNotFound({
  domain,
  topics,
}: {
  domain: string
  topics: readonly Topic[]
}): Effect.Effect<Topic, NotFoundError> {
  const activeTopic = findActiveByCameraTopic(topics)

  if (!activeTopic) {
    return Effect.fail(
      new NotFoundError({
        resource: 'ActiveTopic',
        identifier: { domain },
      }),
    )
  }

  return Effect.succeed(activeTopic)
}
