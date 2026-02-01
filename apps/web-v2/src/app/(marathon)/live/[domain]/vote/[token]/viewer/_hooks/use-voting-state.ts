"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export interface VotingSubmission {
  submissionId: number;
  participantId: number;
  participantFirstName: string;
  participantLastName: string;
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

interface UseVotingStateOptions {
  submissions: VotingSubmission[];
  storageKey: string;
}

export function useVotingState({
  submissions,
  storageKey,
}: UseVotingStateOptions) {
  const [state, setState] = useState<VotingState>(() => {
    if (typeof window === "undefined") {
      return { ratings: {}, selectedSubmissionId: null };
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as VotingState;
        // Validate that ratings only include submissions that exist
        const validRatings: Record<number, number> = {};
        const submissionIds = new Set(submissions.map((s) => s.submissionId));
        for (const [key, value] of Object.entries(parsed.ratings)) {
          const submissionId = parseInt(key, 10);
          if (
            !isNaN(submissionId) &&
            submissionIds.has(submissionId) &&
            value !== undefined &&
            value !== null
          ) {
            validRatings[submissionId] = value;
          }
        }
        return {
          ratings: validRatings,
          selectedSubmissionId:
            parsed.selectedSubmissionId &&
            submissionIds.has(parsed.selectedSubmissionId)
              ? parsed.selectedSubmissionId
              : null,
        };
      }
    } catch (e) {
      console.error("Failed to load voting state from localStorage", e);
    }
    return { ratings: {}, selectedSubmissionId: null };
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save voting state to localStorage", e);
    }
  }, [state, storageKey]);

  const setRating = useCallback(
    (submissionId: number, rating: number | undefined) => {
      setState((prev) => ({
        ...prev,
        ratings: {
          ...prev.ratings,
          [submissionId]: rating,
        },
      }));
    },
    [],
  );

  const setSelectedSubmission = useCallback((submissionId: number | null) => {
    setState((prev) => ({
      ...prev,
      selectedSubmissionId: submissionId,
    }));
  }, []);

  const getRating = useCallback(
    (submissionId: number) => state.ratings[submissionId],
    [state.ratings],
  );

  // Filter submissions by rating
  const getFilteredSubmissions = useCallback(
    (filterRating: number | null) => {
      if (filterRating === null) return submissions;
      return submissions.filter(
        (s) => state.ratings[s.submissionId] === filterRating,
      );
    },
    [submissions, state.ratings],
  );

  // Statistics
  const stats = useMemo(() => {
    const total = submissions.length;
    const rated = Object.keys(state.ratings).filter(
      (id) => state.ratings[parseInt(id, 10)] !== undefined,
    ).length;
    const unrated = total - rated;
    const hasCompletedReview = rated === total && total > 0;
    const hasSelectedFinal = state.selectedSubmissionId !== null;

    // Count by rating
    const ratingCounts: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const rating of Object.values(state.ratings)) {
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
  }, [submissions, state.ratings, state.selectedSubmissionId]);

  return {
    ratings: state.ratings,
    selectedSubmissionId: state.selectedSubmissionId,
    setRating,
    setSelectedSubmission,
    getRating,
    getFilteredSubmissions,
    stats,
  };
}
