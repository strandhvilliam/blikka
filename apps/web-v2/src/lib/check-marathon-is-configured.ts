import type {
  CompetitionClass,
  DeviceGroup,
  Marathon,
  Topic,
} from "@blikka/db";

interface RequiredAction {
  action: string;
  description: string;
}

interface ConfigurationCheck {
  isConfigured: boolean;
  requiredActions: RequiredAction[];
}

export function checkIfMarathonIsProperlyConfigured({
  marathon,
  deviceGroups,
  competitionClasses,
  topics,
}: {
  marathon: Marathon;
  deviceGroups: DeviceGroup[];
  competitionClasses: CompetitionClass[];
  topics: Topic[];
}): ConfigurationCheck {
  if (!marathon?.startDate || !marathon?.endDate) {
    return {
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_dates",
          description: "Add the start and end dates to the marathon",
        },
      ],
    };
  }

  if (!marathon?.name) {
    return {
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_name",
          description: "Add the name to the marathon",
        },
      ],
    };
  }
  if (deviceGroups.length === 0) {
    return {
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_device_groups",
          description: "Add device groups to the marathon",
        },
      ],
    };
  }

  if (competitionClasses.length === 0) {
    return {
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_competition_classes",
          description: "Add competition classes to the marathon",
        },
      ],
    };
  }

  if (topics.length === 0) {
    return {
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_topics",
          description: "Add topics to the marathon",
        },
      ],
    };
  }

  if (
    competitionClasses.some(
      (competitionClass) => competitionClass.numberOfPhotos > topics.length,
    )
  ) {
    return {
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_competition_class_topics",
          description:
            "Add topics to the competition classes to minimally match the number of photos required for each competition class",
        },
      ],
    };
  }

  return {
    isConfigured: true,
    requiredActions: [],
  };
}
