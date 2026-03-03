"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface VotingSubmission {
  submissionId: number;
  participantId: number;
  url?: string | undefined;
  thumbnailUrl?: string | undefined;
  previewUrl?: string | undefined;
  topicId: number;
  topicName: string;
}

interface VotingState {
  ratings: Record<number, number | undefined>;
  selectedSubmissionId: number | null;
}

interface VotingStore extends VotingState {
  setRating: (submissionId: number, rating: number | undefined) => void;
  setSelectedSubmission: (submissionId: number | null) => void;
}

interface UseVotingStateOptions {
  domain: string;
  token: string;
  storageKey?: string;
}

const createVotingStore = (storageKey: string) =>
  create<VotingStore>()(
    persist(
      (set) => ({
        ratings: {},
        selectedSubmissionId: null,
        setRating: (submissionId, rating) =>
          set((state) => {
            if (rating === undefined) {
              const { [submissionId]: _removed, ...remaining } = state.ratings;
              return { ratings: remaining };
            }
            return {
              ratings: {
                ...state.ratings,
                [submissionId]: rating,
              },
            };
          }),
        setSelectedSubmission: (submissionId) =>
          set({ selectedSubmissionId: submissionId }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          ratings: state.ratings,
          selectedSubmissionId: state.selectedSubmissionId,
        }),
      },
    ),
  );

const votingStores = new Map<string, ReturnType<typeof createVotingStore>>();

const getVotingStore = (storageKey: string) => {
  const existingStore = votingStores.get(storageKey);
  if (existingStore) return existingStore;
  const newStore = createVotingStore(storageKey);
  votingStores.set(storageKey, newStore);
  return newStore;
};

export function useVotingState({
  domain,
  token,
  storageKey,
}: UseVotingStateOptions) {
  const trpc = useTRPC();
  const { data: votingData, isLoading } = useQuery(
    trpc.voting.getVotingSubmissions.queryOptions(
      { token, domain },
      {
        enabled: !!token && !!domain,
      },
    ),
  );

  const submissions = votingData?.submissions ?? [];
  const resolvedStorageKey = useMemo(
    () => storageKey ?? `voting-${domain}-${token || "anon"}`,
    [domain, storageKey, token],
  );

  const useVotingStore = useMemo(
    () => getVotingStore(resolvedStorageKey),
    [resolvedStorageKey],
  );


  const ratings = useVotingStore((state) => state.ratings);
  const selectedSubmissionId = useVotingStore(
    (state) => state.selectedSubmissionId,
  );
  const setRating = useVotingStore((state) => state.setRating);
  const setSelectedSubmission = useVotingStore(
    (state) => state.setSelectedSubmission,
  );

  useEffect(() => {
    if (isLoading || !votingData) return;
    const submissionIds = new Set(submissions.map((s) => s.submissionId));
    const currentState = useVotingStore.getState();
    const currentRatings = currentState.ratings;
    const currentSelectedId = currentState.selectedSubmissionId;

    if (submissionIds.size === 0) {
      if (
        Object.keys(currentRatings).length > 0 ||
        currentSelectedId !== null
      ) {
        useVotingStore.setState(
          { ratings: {}, selectedSubmissionId: null },
          false,
        );
      }
      return;
    }

    let hasChanges = false;
    const nextRatings: Record<number, number> = {};
    for (const [key, value] of Object.entries(currentRatings)) {
      const submissionId = parseInt(key, 10);
      if (
        !Number.isNaN(submissionId) &&
        submissionIds.has(submissionId) &&
        value !== undefined &&
        value !== null
      ) {
        nextRatings[submissionId] = value;
      } else {
        hasChanges = true;
      }
    }

    const nextSelectedId =
      currentSelectedId !== null && submissionIds.has(currentSelectedId)
        ? currentSelectedId
        : null;
    if (nextSelectedId !== currentSelectedId) {
      hasChanges = true;
    }

    if (hasChanges) {
      useVotingStore.setState(
        { ratings: nextRatings, selectedSubmissionId: nextSelectedId },
        false,
      );
    }
  }, [isLoading, submissions, useVotingStore, votingData]);

  const getRating = useCallback(
    (submissionId: number) => {
      return ratings[submissionId];
    },
    [ratings],
  );

  const getFilteredSubmissions = useCallback(
    (filterRating: number | null) => {
      if (filterRating === null) return submissions;
      return submissions.filter(
        (s) => ratings[s.submissionId] === filterRating,
      );
    },
    [submissions, ratings],
  );

  const stats = useMemo(() => {
    const total = submissions.length;
    const rated = Object.keys(ratings).filter(
      (id) => ratings[parseInt(id, 10)] !== undefined,
    ).length;
    const unrated = total - rated;
    const hasCompletedReview = rated === total && total > 0;
    const hasSelectedFinal = selectedSubmissionId !== null;

    const ratingCounts: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const rating of Object.values(ratings)) {
      if (rating !== undefined && rating >= 1 && rating <= 5) {
        ratingCounts[rating]++;
      }
    }

    return {
      total,
      rated,
      unrated,
      hasCompletedReview,
      hasSelectedFinal,
      ratingCounts,
    };
  }, [submissions, ratings, selectedSubmissionId]);

  return {
    isLoading,
    ratings,
    selectedSubmissionId,
    setRating,
    setSelectedSubmission,
    getRating,
    getFilteredSubmissions,
    stats,
  };
}
