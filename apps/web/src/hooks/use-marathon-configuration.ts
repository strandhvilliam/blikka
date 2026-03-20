import { useMemo } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { CompetitionClass, DeviceGroup, Marathon, Topic } from "@blikka/db"

import { useTRPC } from "@/lib/trpc/client"

export interface RequiredAction {
  action: string
  description: string
}

export interface MarathonConfigurationResult {
  marathon: MarathonWithRelations | null
  isConfigured: boolean
  requiredActions: RequiredAction[]
}

type MarathonWithRelations = Marathon & {
  deviceGroups: DeviceGroup[]
  competitionClasses: CompetitionClass[]
  topics: Topic[]
}

function checkConfiguration({
  marathon,
  deviceGroups,
  competitionClasses,
  topics,
}: {
  marathon: Marathon
  deviceGroups: DeviceGroup[]
  competitionClasses: CompetitionClass[]
  topics: Topic[]
}): MarathonConfigurationResult {
  if (!marathon?.startDate || !marathon?.endDate) {
    return {
      marathon: marathon as MarathonWithRelations,
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_dates",
          description: "Add the start and end dates to the marathon",
        },
      ],
    }
  }

  if (!marathon?.name) {
    return {
      marathon: marathon as MarathonWithRelations,
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_name",
          description: "Add the name to the marathon",
        },
      ],
    }
  }

  if (deviceGroups.length === 0) {
    return {
      marathon: marathon as MarathonWithRelations,
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_device_groups",
          description: "Add device groups to the marathon",
        },
      ],
    }
  }

  if (competitionClasses.length === 0) {
    return {
      marathon: marathon as MarathonWithRelations,
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_competition_classes",
          description: "Add competition classes to the marathon",
        },
      ],
    }
  }

  if (topics.length === 0) {
    return {
      marathon: marathon as MarathonWithRelations,
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_topics",
          description: "Add topics to the marathon",
        },
      ],
    }
  }

  if (
    competitionClasses.some((competitionClass) => competitionClass.numberOfPhotos > topics.length)
  ) {
    return {
      marathon: marathon as MarathonWithRelations,
      isConfigured: false,
      requiredActions: [
        {
          action: "missing_competition_class_topics",
          description:
            "Add topics to the competition classes to minimally match the number of photos required for each competition class",
        },
      ],
    }
  }

  return {
    marathon: marathon as MarathonWithRelations,
    isConfigured: true,
    requiredActions: [],
  }
}

export function useMarathonConfiguration(domain: string): MarathonConfigurationResult {
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  return useMemo(() => {
    if (!marathon) {
      return {
        marathon: null,
        isConfigured: false,
        requiredActions: [],
      }
    }

    const result = checkConfiguration({
      marathon,
      deviceGroups: marathon.deviceGroups ?? [],
      competitionClasses: marathon.competitionClasses ?? [],
      topics: marathon.topics ?? [],
    })

    return result
  }, [marathon])
}
