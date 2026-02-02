"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { EmptyState } from "./empty-state";
import { CarouselView } from "./carousel-view";
import { GridView } from "./grid-view";
import { VotingFooter } from "./voting-footer";
import { useVotingState } from "../_hooks/use-voting-state";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDomainPathname } from "@/lib/utils";
import { FilterBarSkeleton } from "./filter-bar-skeleton";
import { VotingCarouselApiProvider } from "../_hooks/use-voting-carousel-api";

const FilterBar = dynamic(
  () => import("./filter-bar").then((mod) => mod.FilterBar),
  { ssr: false, loading: () => <FilterBarSkeleton /> },
);

export function VotingClient({
  domain,
  token,
}: {
  domain: string;
  token: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const submitVoteMutation = useMutation(
    trpc.voting.submitVote.mutationOptions(),
  );

  const { currentImageIndex, viewMode, setViewMode, currentFilter } =
    useVotingSearchParams();

  const {
    isLoading,
    selectedSubmissionId,
    setRating,
    setSelectedSubmission,
    getRating,
    getFilteredSubmissions,
    stats,
  } = useVotingState({
    domain,
    token,
  });

  const filteredSubmissions = getFilteredSubmissions(currentFilter);
  const currentSubmission = filteredSubmissions[currentImageIndex];
  const currentRating = currentSubmission
    ? getRating(currentSubmission.submissionId)
    : undefined;
  const isSelected = currentSubmission
    ? currentSubmission.submissionId === selectedSubmissionId
    : false;
  const hasImages = filteredSubmissions.length > 0;

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
        router.push(
          formatDomainPathname(`/live/vote/${token}/completed`, domain, "live"),
        );
      } else if (result.error === "already_voted") {
        toast.error("You have already voted");
        router.push(
          formatDomainPathname(`/live/vote/${token}/completed`, domain, "live"),
        );
      }
    } catch (error) {
      toast.error("Failed to submit vote. Please try again.");
      console.error("Vote submission error:", error);
    }
  };

  if (!hasMounted || isLoading) {
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
    <VotingCarouselApiProvider>
      <div className="flex flex-col h-dvh pb-[env(safe-area-inset-bottom)]">
        <FilterBar
          ratingCounts={stats.ratingCounts}
          totalCount={filteredSubmissions.length}
          onViewModeChange={setViewMode}
          ratedCount={stats.rated}
        />

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
                <EmptyState />
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
                <CarouselView submissions={filteredSubmissions} />
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, }}
                animate={{ opacity: 1, }}
                exit={{ opacity: 0, }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="h-full"
              >
                <GridView
                  submissions={filteredSubmissions}
                  selectedSubmissionId={selectedSubmissionId}
                  getRating={getRating}
                  onViewModeChange={setViewMode}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <VotingFooter
          currentRating={currentRating}
          onRatingChange={handleRatingChange}
          isSelected={isSelected}
          hasImages={hasImages}
          onVote={handleVote}
          totalCount={filteredSubmissions.length}
          submissionTitle={currentSubmission?.topicName}
          onViewModeChange={setViewMode}
        />
      </div>
    </VotingCarouselApiProvider>
  );
}
