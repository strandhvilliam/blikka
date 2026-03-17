"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  getVotingReviewStats,
  sanitizeVotingState,
} from "../_lib/voting-review-state";
import type { VotingSubmission } from "../_lib/voting-submission";

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
              const remaining = { ...state.ratings };
              delete remaining[submissionId];
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
        // Only persist star ratings locally. Final vote (selectedSubmissionId) must
        // come from server so admin reset of voting session is respected.
        partialize: (state) => ({ ratings: state.ratings }),
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

  const submissions = useMemo<VotingSubmission[]>(
    () => votingData?.submissions ?? [],
    [votingData?.submissions],
  );
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
    const currentState = useVotingStore.getState();
    // Server is source of truth for final vote - respects admin reset
    const serverSelectedSubmissionId = votingData.votedSubmissionId ?? null;
    const nextState = sanitizeVotingState({
      submissions,
      ratings: currentState.ratings,
      selectedSubmissionId: serverSelectedSubmissionId,
    });

    if (nextState.hasChanges) {
      useVotingStore.setState(
        {
          ratings: nextState.ratings,
          selectedSubmissionId: nextState.selectedSubmissionId,
        },
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
    return getVotingReviewStats({
      submissions,
      ratings,
      selectedSubmissionId,
    });
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
