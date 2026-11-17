export type TopicStatus = "done" | "open" | "locked" | "missed";

type Competition<T> = {
  opensAt: Date | null;
  closesAt: Date | null;
  topicsInSequence: boolean;
  minutesPerTopic: number | null;
  topics: ReadonlyArray<T>;
};

const earliest = (a: Date | null, b: Date | null) => {
  if (a && b) {
    return a < b ? a : b;
  }

  return a ?? b;
};

export const availableTopics = <T extends { id: string }>(
  competition: Competition<T>,
  participant: { createdAt: Date },
  submissions: ReadonlyArray<{ topicId: string; createdAt: Date }>,
  now: Date,
): Array<T & { status: TopicStatus; closesAt: Date | null }> => {
  const submittedAt = new Map(submissions.map((submission) => [submission.topicId, submission.createdAt]));
  const closed = competition.closesAt !== null && competition.closesAt <= now;

  let unlocksAt =
    competition.opensAt && new Date(Math.max(competition.opensAt.getTime(), participant.createdAt.getTime()));

  const topics = [];

  for (const topic of competition.topics) {
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

    if (competition.topicsInSequence) {
      unlocksAt = unlocksAt && earliest(submitted ?? null, deadline);
    }
  }

  return topics;
};
