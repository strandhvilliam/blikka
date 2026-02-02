"use client";

import * as React from "react";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { type CarouselApi } from "@/components/ui/carousel";
import { AnimatePresence, motion } from "motion/react";
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
      // Redirect to voting completed page
      router.push(`/live/${domain}/vote/${token}/voting-completed`);
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

  // Submit vote mutation
  const submitVoteMutation = useMutation(
    trpc.voting.submitVote.mutationOptions(),
  );

  const handleRatingChange = (rating: number) => {
    if (!currentSubmission) return;
    setRating(currentSubmission.submissionId, rating);
    toast.success(`Rated ${rating} stars`, {
      duration: 1000,
      position: "top-center",
    });
  };

  const handleVote = async () => {
    if (!currentSubmission) return;

    setSelectedSubmission(currentSubmission.submissionId);

    if (!token || !domain) {
      toast.error("Missing voting session information");
      return;
    }

    try {
      const result = await submitVoteMutation.mutateAsync({
        token,
        submissionId: currentSubmission.submissionId,
        domain,
      });

      if (result.success) {
        toast.success("Vote submitted successfully!");
        router.push(`/live/${domain}/vote/${token}/voting-completed`);
      } else if (result.error === "already_voted") {
        toast.error("You have already voted");
        router.push(`/live/${domain}/vote/${token}/voting-completed`);
      }
    } catch (error) {
      toast.error("Failed to submit vote. Please try again.");
      console.error("Vote submission error:", error);
    }
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
      <div className="flex flex-col h-dvh bg-background pb-[env(safe-area-inset-bottom)]">
        <FilterBarSkeleton />
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="w-full h-full max-w-4xl max-h-[80vh]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh pb-[env(safe-area-inset-bottom)]">
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
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!hasImages ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <EmptyState
                currentFilter={currentFilter}
                onClearFilter={() => setCurrentFilter(null)}
              />
            </motion.div>
          ) : viewMode === "carousel" ? (
            <motion.div
              key="carousel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="h-full"
            >
              <CarouselView
                submissions={filteredSubmissions}
                currentFilter={currentFilter}
                onApiChange={setApi}
              />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="h-full"
            >
              <GridView
                submissions={filteredSubmissions}
                selectedSubmissionId={selectedSubmissionId}
                currentImageIndex={currentImageIndex}
                getRating={getRating}
                onThumbnailClick={handleThumbnailClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls / Footer */}
      <VotingFooter
        viewMode={viewMode}
        currentRating={currentRating}
        onRatingChange={handleRatingChange}
        isSelected={isSelected}
        hasImages={hasImages}
        onVote={handleVote}
        api={api}
        currentIndex={currentImageIndex}
        totalCount={filteredSubmissions.length}
        submissionTitle={currentSubmission?.topicName}
      />
    </div>
  );
}
