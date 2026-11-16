export type TopicStatus = "done" | "open" | "locked" | "missed";

type Competition<T> = {
  opensAt: Date | null;
  closesAt: Date | null;
  // In position order.
  topics: ReadonlyArray<T>;
};

// The one place that decides which topics a participant can shoot (adr/0009). It checks only the
// competition's window so far; topic windows, sequence, time per topic and classes each extend it.
export const availableTopics = <T extends { id: string }>(
  competition: Competition<T>,
  submissions: ReadonlyArray<{ topicId: string }>,
  now: Date,
): Array<T & { status: TopicStatus }> => {
  const submitted = new Set(submissions.map((submission) => submission.topicId));
  // Null opensAt is not open yet, null closesAt is no deadline.
  const opened = competition.opensAt !== null && competition.opensAt <= now;
  const closed = competition.closesAt !== null && competition.closesAt <= now;

  return competition.topics.map((topic) => {
    if (submitted.has(topic.id)) {
      return { ...topic, status: "done" };
    }

    if (closed) {
      return { ...topic, status: "missed" };
    }

    if (!opened) {
      return { ...topic, status: "locked" };
    }

    return { ...topic, status: "open" };
  });
};
