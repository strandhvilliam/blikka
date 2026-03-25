"use client";

import { useCallback, useMemo, useTransition } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { parseAsArrayOf, parseAsInteger, useQueryState } from "nuqs";
import { JuryParticipantList } from "./jury-participant-list";
import { JuryReviewHeader } from "./jury-review-header";
import { JurySubmissionViewer } from "./jury-submission-viewer";
import {
  getAssignedFinalRankingCount,
  hasCompleteFinalRankings,
} from "../_lib/jury-final-ranking-state";
import type { JuryListParticipant } from "../_lib/jury-list-participant";

export function JuryReviewClient({
  domain,
  token,
}: {
  domain: string;
  token: string;
}) {
  const trpc = useTRPC();
  const [isFilterPending, startFilterTransition] = useTransition();
  const [selectedParticipantId, setSelectedParticipantId] = useQueryState(
    "participant",
    parseAsInteger,
  );
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(0),
  );
  const [selectedRatings, setSelectedRatings] = useQueryState(
    "ratings",
    parseAsArrayOf(parseAsInteger).withDefault([]),
  );

  const { data: invitation } = useSuspenseQuery(
    trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
  );
  const { data: ratingsData } = useSuspenseQuery(
    trpc.jury.getJuryRatingsByInvitation.queryOptions({ domain, token }),
  );
  const { data: reviewSetParticipantCount } = useQuery(
    trpc.jury.getJuryParticipantCount.queryOptions({
      domain,
      token,
    }),
  );

  const {
    data: filteredParticipantCount,
    isFetching: isFetchingParticipantCount,
  } = useQuery(
    trpc.jury.getJuryParticipantCount.queryOptions(
      {
        domain,
        token,
        ratingFilter: selectedRatings.length > 0 ? selectedRatings : undefined,
      },
      {
        placeholderData: keepPreviousData,
      },
    ),
  );

  const totalParticipants =
    selectedRatings.length > 0
      ? filteredParticipantCount
      : (reviewSetParticipantCount ?? filteredParticipantCount);

  const {
    data,
    fetchNextPage,
    hasNextPage = false,
    isFetching,
    isFetchingNextPage,
    isPending,
    error,
  } = useInfiniteQuery(
    trpc.jury.getJurySubmissionsFromToken.infiniteQueryOptions(
      {
        domain,
        token,
        ratingFilter: selectedRatings.length > 0 ? selectedRatings : undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor,
        placeholderData: keepPreviousData,
      },
    ),
  );

  const participants = useMemo(
    () =>
      (data?.pages ?? []).flatMap(
        (page) => page.participants,
      ) as JuryListParticipant[],
    [data?.pages],
  );

  const reviewSetTotalParticipants =
    reviewSetParticipantCount?.value ??
    totalParticipants?.value ??
    participants.length;

  const ratingByParticipantId = useMemo(
    () =>
      new Map(
        ratingsData.ratings.map((rating) => [rating.participantId, rating]),
      ),
    [ratingsData.ratings],
  );
  const assignedFinalRankingCount = getAssignedFinalRankingCount(
    ratingsData.ratings,
  );
  const canCompleteReview = hasCompleteFinalRankings(ratingsData.ratings);

  const handleParticipantSelect = useCallback(
    (participantId: number, index: number) => {
      void setCurrentParticipantIndex(index);
      void setSelectedParticipantId(participantId);
    },
    [setCurrentParticipantIndex, setSelectedParticipantId],
  );

  const handleBackToList = useCallback(() => {
    void setSelectedParticipantId(null);
    void setCurrentParticipantIndex(0);
  }, [setCurrentParticipantIndex, setSelectedParticipantId]);

  const clearRatingFilter = useCallback(() => {
    startFilterTransition(() => {
      void setSelectedParticipantId(null);
      void setCurrentParticipantIndex(0);
      void setSelectedRatings([]);
    });
  }, [
    setCurrentParticipantIndex,
    setSelectedParticipantId,
    setSelectedRatings,
  ]);

  const toggleRatingFilter = useCallback(
    (rating: number) => {
      startFilterTransition(() => {
        void setSelectedParticipantId(null);
        void setCurrentParticipantIndex(0);
        void setSelectedRatings((previous) => {
          const nextRatings = previous.includes(rating) ? [] : [rating];

          return nextRatings.toSorted((left, right) => left - right);
        });
      });
    },
    [setCurrentParticipantIndex, setSelectedParticipantId, setSelectedRatings],
  );

  const selectedIndex = useMemo(() => {
    if (selectedParticipantId === null) {
      return currentParticipantIndex;
    }

    const index = participants.findIndex(
      (participant) => participant.id === selectedParticipantId,
    );
    return index >= 0 ? index : 0;
  }, [currentParticipantIndex, participants, selectedParticipantId]);

  const isRefreshingResults =
    isFilterPending ||
    isFetchingParticipantCount ||
    (isFetching && !isFetchingNextPage);
  const shouldShowViewer =
    selectedParticipantId !== null && participants.length > 0;

  return (
    <main className="min-h-dvh bg-neutral-50 bg-dot-pattern-light">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <JuryReviewHeader
          domain={domain}
          token={token}
          invitation={invitation}
          ratedCount={ratingsData.ratings.length}
          totalParticipants={reviewSetTotalParticipants}
          assignedFinalRankingCount={assignedFinalRankingCount}
          canCompleteReview={canCompleteReview}
        />

        {shouldShowViewer ? (
          <JurySubmissionViewer
            domain={domain}
            token={token}
            invitation={invitation}
            participants={participants}
            initialIndex={selectedIndex}
            selectedRatings={selectedRatings}
            ratings={ratingsData.ratings}
            totalParticipants={totalParticipants?.value ?? participants.length}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            ratingByParticipantId={ratingByParticipantId}
            onBack={handleBackToList}
          />
        ) : (
          <JuryParticipantList
            participants={participants}
            ratingByParticipantId={ratingByParticipantId}
            selectedRatings={selectedRatings}
            toggleRatingFilter={toggleRatingFilter}
            clearRatingFilter={clearRatingFilter}
            onParticipantSelect={handleParticipantSelect}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isPendingParticipants={isPending}
            isRefreshingResults={isRefreshingResults}
            totalParticipants={totalParticipants}
            error={error as Error | null}
          />
        )}
      </div>
    </main>
  );
}
