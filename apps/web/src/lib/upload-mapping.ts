export type UploadMarathonMode = "marathon" | "by-camera";

type TopicWithOrderIndex = {
  orderIndex: number;
};

type CompetitionClassWithTopicRange = {
  topicStartIndex: number;
  numberOfPhotos: number;
};

export function getSelectedTopics<T extends TopicWithOrderIndex>(
  marathonMode: UploadMarathonMode,
  activeByCameraTopic: T | null,
  selectedCompetitionClass: CompetitionClassWithTopicRange | null,
  sortedTopics: T[],
): T[] {
  if (marathonMode === "by-camera") {
    return activeByCameraTopic ? [activeByCameraTopic] : [];
  }

  if (!selectedCompetitionClass) {
    return [];
  }

  return sortedTopics.slice(
    selectedCompetitionClass.topicStartIndex,
    selectedCompetitionClass.topicStartIndex +
      selectedCompetitionClass.numberOfPhotos,
  );
}

export function getExpectedPhotoCount(
  marathonMode: UploadMarathonMode,
  activeByCameraTopic: TopicWithOrderIndex | null,
  selectedCompetitionClass: { numberOfPhotos: number } | null,
): number {
  if (marathonMode === "by-camera") {
    return activeByCameraTopic ? 1 : 0;
  }

  return selectedCompetitionClass?.numberOfPhotos ?? 0;
}
