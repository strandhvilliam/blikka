"use client";

import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { type SortingState } from "@tanstack/react-table";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { submissionSearchParams } from "../_lib/search-params";
import {
  getTabQueryParams,
  normalizeIdArray,
} from "../_lib/submissions-table-utils";
import type { Participant, CompetitionClass, DeviceGroup } from "@blikka/db";

const SEARCH_DEBOUNCE_MS = 300;
const PARTICIPANTS_PAGE_SIZE = 50;

function parseMultiSelectValue(value: string): number[] | null {
  return value === "all" ? null : value.split(",").map(Number);
}

function useSubmissionTableQueryState() {
  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  });

  const {
    tab: activeTab,
    search,
    competitionClassId,
    deviceGroupId,
  } = queryState;
  const [debouncedSearch] = useDebounce(search ?? "", SEARCH_DEBOUNCE_MS);

  const tabQueryParams = getTabQueryParams(activeTab);
  const normalizedCompetitionClassId = normalizeIdArray(competitionClassId);
  const normalizedDeviceGroupId = normalizeIdArray(deviceGroupId);

  const handleCompetitionClassChange = useCallback(
    (value: string) => {
      setQueryState({ competitionClassId: parseMultiSelectValue(value) });
    },
    [setQueryState],
  );

  const handleDeviceGroupChange = useCallback(
    (value: string) => {
      setQueryState({ deviceGroupId: parseMultiSelectValue(value) });
    },
    [setQueryState],
  );

  return {
    queryState,
    setQueryState,
    debouncedSearch,
    tabQueryParams,
    normalizedCompetitionClassId,
    normalizedDeviceGroupId,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
  };
}

export type TableData = Omit<Participant, "phoneEncrypted" | "phoneHash"> & {
  phoneNumber?: string | null;
  competitionClass: CompetitionClass | null;
  deviceGroup: DeviceGroup | null;
  activeTopicSubmissionId: number | null;
  submissionHealth: {
    hasExif: boolean;
    hasThumbnail: boolean;
  } | null;
  failedValidationResults: { errors: number; warnings: number };
  passedValidationResults: { errors: number; warnings: number };
  skippedValidationResults: { errors: number; warnings: number };
  zipKeys: string[];
  contactSheetKeys: string[];
  votingSession: { votedAt: string | null } | null;
};

function useParticipantCollections(participants: TableData[]) {
  return useMemo(() => {
    const participantIds: number[] = [];
    const participantIndexById = new Map<number, number>();
    const participantsById = new Map<number, TableData>();

    for (let index = 0; index < participants.length; index++) {
      const participant = participants[index];
      participantIds.push(participant.id);
      participantIndexById.set(participant.id, index);
      participantsById.set(participant.id, participant);
    }

    return { participantIds, participantIndexById, participantsById };
  }, [participants]);
}

interface UseParticipantSelectionInput {
  participantIds: number[];
  participantIndexById: Map<number, number>;
  participantsById: Map<number, TableData>;
}

function useParticipantSelection({
  participantIds,
  participantIndexById,
  participantsById,
}: UseParticipantSelectionInput) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const toggleSelection = useCallback(
    (id: number, event: React.MouseEvent) => {
      setSelectedIds((previousSelection) => {
        const nextSelection = new Set(previousSelection);

        if (event.shiftKey && lastSelectedId !== null) {
          const lastIndex = participantIndexById.get(lastSelectedId);
          const currentIndex = participantIndexById.get(id);

          if (lastIndex !== undefined && currentIndex !== undefined) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);

            for (let index = start; index <= end; index++) {
              const participantId = participantIds[index];
              if (participantId !== undefined) {
                nextSelection.add(participantId);
              }
            }
          }

          return nextSelection;
        }

        if (nextSelection.has(id)) {
          nextSelection.delete(id);
        } else {
          nextSelection.add(id);
        }

        return nextSelection;
      });

      if (!event.shiftKey) {
        setLastSelectedId(id);
      }
    },
    [lastSelectedId, participantIds, participantIndexById],
  );

  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((previousSelection) => {
      const allVisibleSelected = participantIds.every((id) =>
        previousSelection.has(id),
      );
      const nextSelection = new Set(previousSelection);

      for (const id of participantIds) {
        if (allVisibleSelected) {
          nextSelection.delete(id);
        } else {
          nextSelection.add(id);
        }
      }

      return nextSelection;
    });
  }, [participantIds]);

  const canVerifySelected = useMemo(() => {
    if (selectedIds.size === 0) return false;

    for (const id of selectedIds) {
      if (participantsById.get(id)?.status !== "completed") {
        return false;
      }
    }

    return true;
  }, [participantsById, selectedIds]);

  return {
    selectedIds,
    selectedCount,
    hasSelection,
    toggleSelection,
    toggleAllVisible,
    isSelected,
    clearSelection,
    canVerifySelected,
  };
}

export function useSubmissionsTable() {
  const domain = useDomain();
  const trpc = useTRPC();
  const participantsQueryPathKey = useMemo(
    () => trpc.participants.getByDomainInfinite.pathKey(),
    [trpc],
  );
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const {
    queryState,
    setQueryState,
    debouncedSearch,
    tabQueryParams,
    normalizedCompetitionClassId,
    normalizedDeviceGroupId,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
  } = useSubmissionTableQueryState();

  const activeByCameraTopicId =
    marathon?.mode === "by-camera"
      ? (marathon.topics.find((topic) => topic.visibility === "active")?.id ??
        -1)
      : null;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery(
    trpc.participants.getByDomainInfinite.infiniteQueryOptions(
      {
        domain,
        cursor: null,
        search: debouncedSearch || null,
        sortOrder: queryState.sortOrder || null,
        competitionClassId: normalizedCompetitionClassId ?? null,
        deviceGroupId: normalizedDeviceGroupId ?? null,
        topicId: activeByCameraTopicId,
        statusFilter: tabQueryParams.statusFilter,
        excludeStatuses: tabQueryParams.excludeStatuses,
        includeStatuses: tabQueryParams.includeStatuses ?? null,
        hasValidationErrors: tabQueryParams.hasValidationErrors,
        votedFilter: tabQueryParams.votedFilter ?? null,
        limit: PARTICIPANTS_PAGE_SIZE,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      },
    ),
  );

  const participants = useMemo(
    () =>
      (data?.pages.flatMap((page) => page.participants) ?? []) as TableData[],
    [data],
  );
  const { participantIds, participantIndexById, participantsById } =
    useParticipantCollections(participants);
  const {
    selectedIds,
    selectedCount,
    hasSelection,
    toggleSelection,
    toggleAllVisible,
    isSelected,
    clearSelection,
    canVerifySelected,
  } = useParticipantSelection({
    participantIds,
    participantIndexById,
    participantsById,
  });

  const observerTarget = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
  });

  return {
    marathon,
    sorting,
    setSorting,
    queryState,
    setQueryState,
    participants,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    observerTarget,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
    selectedIds,
    selectedCount,
    hasSelection,
    toggleSelection,
    toggleAllVisible,
    isSelected,
    clearSelection,
    canVerifySelected,
    participantsQueryPathKey,
  };
}
