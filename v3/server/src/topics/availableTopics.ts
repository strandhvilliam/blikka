export type TopicStatus = "done" | "open" | "locked" | "missed";

type Competition<T> = {
  opensAt: Date | null;
  closesAt: Date | null;
  topicsInSequence: boolean;
  minutesPerTopic: number | null;
  // In position order.
  topics: ReadonlyArray<T>;
};

const earliest = (a: Date | null, b: Date | null) => {
  if (a && b) {
    return a < b ? a : b;
  }

  return a ?? b;
};

// The one place that decides which topics a participant can shoot (adr/0009). It checks the
// competition's window, sequence and time per topic; topic windows and classes each extend it.
// `closesAt` is when an open or done topic stops taking photos for this participant, null for never.
export const availableTopics = <T extends { id: string }>(
  competition: Competition<T>,
  participant: { createdAt: Date },
  submissions: ReadonlyArray<{ topicId: string; createdAt: Date }>,
  now: Date,
): Array<T & { status: TopicStatus; closesAt: Date | null }> => {
  const submittedAt = new Map(submissions.map((submission) => [submission.topicId, submission.createdAt]));
  // Null closesAt is no deadline.
  const closed = competition.closesAt !== null && competition.closesAt <= now;
  // The first topic unlocks at entry or when the window opens, whichever is later. Null: not yet,
  // as with a null opensAt.

  let unlocksAt =
    competition.opensAt && new Date(Math.max(competition.opensAt.getTime(), participant.createdAt.getTime()));

  const topics = [];

  for (const topic of competition.topics) {
    // The time limit runs from when the topic unlocked, and never past the window.
    const timeUp =
      unlocksAt && competition.minutesPerTopic !== null
        ? new Date(unlocksAt.getTime() + competition.minutesPerTopic * 60_000)
        : null;

    const deadline = earliest(timeUp, competition.closesAt);
    const submitted = submittedAt.get(topic.id);
    let status: TopicStatus;

    if (submitted) {
      status = "done";
    } else if (closed) {
      status = "missed";
    } else if (!unlocksAt || unlocksAt > now) {
      status = "locked";
    } else if (deadline && deadline <= now) {
      status = "missed";
    } else {
      status = "open";
    }

    topics.push({ ...topic, status, closesAt: status === "open" || status === "done" ? deadline : null });

    // The next topic unlocks at this one's first submission or its deadline, whichever comes first,
    // so a participant is never stuck. With neither, it waits.
    if (competition.topicsInSequence) {
      unlocksAt = unlocksAt && earliest(submitted ?? null, deadline);
    }
  }

  return topics;
};
