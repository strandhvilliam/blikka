"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "use-debounce";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { useParticipantEvents } from "./use-participant-events";
import { submissionSearchParams } from "./search-params";
import type { Participant, CompetitionClass, DeviceGroup } from "@blikka/db";

export type TableData = Participant & {
  competitionClass: CompetitionClass | null;
  deviceGroup: DeviceGroup | null;
  failedValidationResults: { errors: number; warnings: number };
  passedValidationResults: { errors: number; warnings: number };
  skippedValidationResults: { errors: number; warnings: number };
  zipKeys: string[];
  contactSheetKeys: string[];
  votingSession: { votedAt: string | null } | null;
};

export function useSubmissionsTable() {
  const domain = useDomain();
  const trpc = useTRPC();
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );
  const [sorting, setSorting] = useState([]);
  useParticipantEvents();

  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  });

  const {
    tab: activeTab,
    search,
    sortOrder,
    competitionClassId,
    deviceGroupId,
  } = queryState;
  const [debouncedSearch] = useDebounce(search || "", 300);

  const normalizedCompetitionClassId = useMemo(() => {
    if (!competitionClassId || competitionClassId.length === 0)
      return undefined;
    return competitionClassId.length === 1
      ? competitionClassId[0]
      : competitionClassId;
  }, [competitionClassId]);

  const normalizedDeviceGroupId = useMemo(() => {
    if (!deviceGroupId || deviceGroupId.length === 0) return undefined;
    return deviceGroupId.length === 1 ? deviceGroupId[0] : deviceGroupId;
  }, [deviceGroupId]);

  const tabQueryParams = useMemo(() => {
    switch (activeTab) {
      case "all":
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: null,
        };
      case "initialized":
        return {
          statusFilter: null,
          excludeStatuses: ["completed", "verified"],
          hasValidationErrors: null,
        };
      case "not-verified":
        return {
          statusFilter: "completed" as const,
          excludeStatuses: null,
          hasValidationErrors: null,
        };
      case "verified":
        return {
          statusFilter: "verified" as const,
          excludeStatuses: null,
          hasValidationErrors: null,
        };
      case "validation-errors":
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: true,
        };
      default:
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: null,
        };
    }
  }, [activeTab]);

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
        sortOrder: sortOrder || null,
        competitionClassId: normalizedCompetitionClassId ?? null,
        deviceGroupId: normalizedDeviceGroupId ?? null,
        statusFilter: tabQueryParams.statusFilter,
        excludeStatuses: tabQueryParams.excludeStatuses,
        hasValidationErrors: tabQueryParams.hasValidationErrors,
        limit: 50,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      },
    ),
  );

  const participants = useMemo(
    () => (data?.pages.flatMap((page) => page.participants) ?? []) as TableData[],
    [data],
  );

  const competitionClasses = useMemo(() => {
    const classes = new Map<number, { id: number; name: string }>();
    participants.forEach((p) => {
      if (p.competitionClass) {
        classes.set(p.competitionClass.id, p.competitionClass);
      }
    });
    return Array.from(classes.values());
  }, [participants]);

  const deviceGroups = useMemo(() => {
    const groups = new Map<number, { id: number; name: string }>();
    participants.forEach((p) => {
      if (p.deviceGroup) {
        groups.set(p.deviceGroup.id, p.deviceGroup);
      }
    });
    return Array.from(groups.values());
  }, [participants]);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleCompetitionClassChange = useCallback(
    (value: string) => {
      if (value === "all") {
        setQueryState({ competitionClassId: null });
      } else {
        const ids = value.split(",").map(Number);
        setQueryState({ competitionClassId: ids });
      }
    },
    [setQueryState],
  );

  const handleDeviceGroupChange = useCallback(
    (value: string) => {
      if (value === "all") {
        setQueryState({ deviceGroupId: null });
      } else {
        const ids = value.split(",").map(Number);
        setQueryState({ deviceGroupId: ids });
      }
    },
    [setQueryState],
  );

  return {
    domain,
    marathon,
    sorting,
    setSorting,
    queryState,
    setQueryState,
    participants,
    competitionClasses,
    deviceGroups,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    observerTarget,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
  };
}
