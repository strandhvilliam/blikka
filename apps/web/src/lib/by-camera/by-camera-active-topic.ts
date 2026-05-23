import type { Marathon, Topic } from '@blikka/db'

type TopicWithVisibility = Pick<Topic, 'visibility'> | { visibility: string }

type MarathonWithTopics<T extends TopicWithVisibility> = Pick<Marathon, 'mode'> & {
  topics: Iterable<T> | T[]
}

/** Returns the topic marked active, or null if none. */
export function findActiveTopic<T extends TopicWithVisibility>(
  topics: Iterable<T> | T[],
): T | null {
  for (const topic of topics) {
    if (topic.visibility === 'active') {
      return topic
    }
  }
  return null
}

/** Active by-camera topic, or null when the marathon is not in by-camera mode. */
export function getActiveByCameraTopic<T extends TopicWithVisibility>(
  marathon: MarathonWithTopics<T>,
): T | null {
  if (marathon.mode !== 'by-camera') {
    return null
  }
  return findActiveTopic(marathon.topics)
}
