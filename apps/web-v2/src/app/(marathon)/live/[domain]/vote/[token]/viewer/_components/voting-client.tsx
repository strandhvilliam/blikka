"use client";

import * as React from "react";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { type CarouselApi } from "@/components/ui/carousel";
import { EmptyState } from "./empty-state";
import { CarouselView } from "./carousel-view";
import { GridView } from "./grid-view";
import { VotingFooter } from "./voting-footer";
import { useVotingState } from "../_hooks/use-voting-state";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const FilterBarSkeleton = () => (
  <div className="px-4 py-3">
    {/* Action buttons skeleton */}
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
    {/* Progress bar skeleton */}
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
    </div>
    {/* Filter options skeleton */}
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-12 rounded-full shrink-0" />
      ))}
    </div>
  </div>
);

const FilterBar = dynamic(
  () => import("./filter-bar").then((mod) => mod.FilterBar),
  { ssr: false, loading: () => <FilterBarSkeleton /> },
);

interface VotingClientProps {
  domain: string;
  token: string;
}

export function VotingClient({ domain, token }: VotingClientProps) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [api, setApi] = React.useState<CarouselApi>();
  const isNavigatingRef = React.useRef(false);

  const {
    currentImageIndex,
    viewMode,
    setCurrentImageIndex,
    setViewMode,
    setParams,
  } = useVotingSearchParams();

  const [currentFilter, setCurrentFilter] = React.useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  // Fetch voting submissions
  const { data: votingData, isLoading: isLoadingSubmissions } =
    useSuspenseQuery(
      trpc.voting.getVotingSubmissions.queryOptions(
        { token, domain },
        {
          enabled: !!token && !!domain,
        },
      ),
    );

  // Handle already voted redirect and extract submissions
  const submissions = React.useMemo(() => {
    if (!votingData) return [];
    if (votingData.alreadyVoted) {
      // Redirect to already voted page
      router.push(`/live/${domain}/vote/${token}/already-voted`);
      return [];
    }
    return votingData.submissions ?? [];
  }, [votingData, domain, token, router]);

  const {
    ratings,
    selectedSubmissionId,
    setRating,
    setSelectedSubmission,
    getRating,
    getFilteredSubmissions,
    stats,
  } = useVotingState({
    submissions,
    storageKey: `voting-${domain}-${token || "anon"}`,
  });

  const filteredSubmissions = React.useMemo(
    () => getFilteredSubmissions(currentFilter),
    [currentFilter, getFilteredSubmissions],
  );

  const handleFilterChange = (filter: number | null) => {
    setCurrentFilter(filter);
    setCurrentImageIndex(0);
  };

  // Track carousel index changes and sync with URL params
  React.useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      // Skip if we're programmatically navigating (URL change -> carousel scroll)
      if (isNavigatingRef.current) return;

      const index = api.selectedScrollSnap();
      if (index !== currentImageIndex) {
        setCurrentImageIndex(index);
      }
    };

    api.on("select", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api, currentImageIndex, setCurrentImageIndex]);

  // Sync carousel with URL param changes
  React.useEffect(() => {
    if (api) {
      isNavigatingRef.current = true;
      api.scrollTo(currentImageIndex);
      // Reset flag after scroll animation
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    }
  }, [api, currentImageIndex]);

  const currentSubmission = filteredSubmissions[currentImageIndex];
  const currentRating = currentSubmission
    ? getRating(currentSubmission.submissionId)
    : undefined;
  const isSelected = currentSubmission
    ? currentSubmission.submissionId === selectedSubmissionId
    : false;

  const handleRatingChange = (rating: number) => {
    if (!currentSubmission) return;
    setRating(currentSubmission.submissionId, rating);
    toast.success(`Rated ${rating} stars`, { duration: 1000 });
  };

  const handleVote = () => {
    if (!currentSubmission) return;
    setSelectedSubmission(currentSubmission.submissionId);
    toast.success("Selected as your vote!");
  };

  // Submit vote mutation
  const submitVoteMutation = useMutation(
    trpc.voting.submitVote.mutationOptions(),
  );

  const handleComplete = async () => {
    if (!selectedSubmissionId) {
      toast.error("Please select an image to vote for first");
      return;
    }
    if (!token || !domain) {
      toast.error("Missing voting session information");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmVote = async () => {
    if (!selectedSubmissionId || !token || !domain) return;

    try {
      const result = await submitVoteMutation.mutateAsync({
        token,
        submissionId: selectedSubmissionId,
        domain,
      });

      if (result.success) {
        toast.success("Vote submitted successfully!");
        router.push(`/live/${domain}/vote/${token}/success`);
      } else if (result.error === "already_voted") {
        toast.error("You have already voted");
        router.push(`/live/${domain}/vote/${token}/already-voted`);
      }
    } catch (error) {
      toast.error("Failed to submit vote. Please try again.");
      console.error("Vote submission error:", error);
    }

    setShowConfirmModal(false);
  };

  const handleThumbnailClick = (index: number) => {
    isNavigatingRef.current = true;
    setParams({ image: index, view: "carousel" });
    // Reset flag after params update
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);
  };

  const hasImages = filteredSubmissions.length > 0;

  if (isLoadingSubmissions) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <FilterBarSkeleton />
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="w-full h-full max-w-4xl max-h-[80vh]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with progress and filter */}
      <FilterBar
        currentFilter={currentFilter}
        onFilterChange={handleFilterChange}
        ratingCounts={stats.ratingCounts}
        currentIndex={currentImageIndex}
        totalCount={filteredSubmissions.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        ratedCount={stats.rated}
      />

      {/* Image viewer - carousel or grid */}
      <div className="flex-1 overflow-hidden">
        {!hasImages ? (
          <EmptyState
            currentFilter={currentFilter}
            onClearFilter={() => setCurrentFilter(null)}
          />
        ) : viewMode === "carousel" ? (
          <CarouselView
            submissions={filteredSubmissions}
            currentFilter={currentFilter}
            onApiChange={setApi}
          />
        ) : (
          <GridView
            submissions={filteredSubmissions}
            selectedSubmissionId={selectedSubmissionId}
            currentImageIndex={currentImageIndex}
            getRating={getRating}
            onThumbnailClick={handleThumbnailClick}
          />
        )}
      </div>

      {/* Bottom controls / Footer */}
      <VotingFooter
        viewMode={viewMode}
        currentRating={currentRating}
        onRatingChange={handleRatingChange}
        isSelected={isSelected}
        hasImages={hasImages}
        onVote={handleVote}
        onComplete={handleComplete}
        showComplete={stats.hasCompletedReview && stats.hasSelectedFinal}
        api={api}
        currentIndex={currentImageIndex}
        totalCount={filteredSubmissions.length}
        completionMessage={
          !stats.hasSelectedFinal && stats.hasCompletedReview
            ? "You've rated all images! Select your final vote above."
            : undefined
        }
      />

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Confirm Your Vote</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to submit your vote? This action cannot be
              undone.
            </p>
            {selectedSubmissionId && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Selected submission:
                </p>
                <p className="font-medium">
                  Submission #{selectedSubmissionId}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVote}
                disabled={submitVoteMutation.isPending}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitVoteMutation.isPending
                  ? "Submitting..."
                  : "Confirm Vote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
