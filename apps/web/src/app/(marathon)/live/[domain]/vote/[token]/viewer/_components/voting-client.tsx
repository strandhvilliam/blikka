"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { useClientReady } from "../_hooks/use-client-ready";

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
  const isClientReady = useClientReady();
  const t = useTranslations("VotingViewerPage");

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
  const isOwnSubmission = currentSubmission?.isOwnSubmission ?? false;
  const currentRating =
    currentSubmission && !currentSubmission.isOwnSubmission
      ? getRating(currentSubmission.submissionId)
      : undefined;
  const isSelected = currentSubmission
    ? currentSubmission.submissionId === selectedSubmissionId
    : false;
  const hasImages = filteredSubmissions.length > 0;

  const handleRatingChange = (rating: number) => {
    if (!currentSubmission || currentSubmission.isOwnSubmission) return;
    setRating(currentSubmission.submissionId, rating);
    toast.success(t("starRating.ratedToast", { rating }), {
      duration: 1000,
      position: "top-center",
    });
  };

  const handleVote = async () => {
    if (!currentSubmission) return;

    if (currentSubmission.isOwnSubmission) {
      toast.error(t("toasts.cannotVoteForOwn"));
      return;
    }

    if (!token || !domain) {
      toast.error(t("toasts.missingSessionInfo"));
      return;
    }

    try {
      const result = await submitVoteMutation.mutateAsync({
        token,
        submissionId: currentSubmission.submissionId,
      });

      if (result.success) {
        setSelectedSubmission(currentSubmission.submissionId);
        toast.success(t("toasts.voteSubmitted"));
        router.push(
          formatDomainPathname(`/live/vote/${token}/completed`, domain, "live"),
        );
      } else if (result.error === "already_voted") {
        toast.error(t("toasts.alreadyVoted"));
        router.push(
          formatDomainPathname(`/live/vote/${token}/completed`, domain, "live"),
        );
      } else if (result.error === "cannot_vote_for_self") {
        toast.error(t("toasts.cannotVoteForOwn"));
      }
    } catch (error) {
      toast.error(t("toasts.submitFailed"));
      console.error("Vote submission error:", error);
    }
  };

  if (!isClientReady || isLoading) {
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
          reviewTotalCount={stats.total}
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
          isOwnSubmission={isOwnSubmission}
          isSelected={isSelected}
          hasVoted={!!selectedSubmissionId}
          hasImages={hasImages}
          onVote={handleVote}
          totalCount={filteredSubmissions.length}
          submissionTitle={currentSubmission?.topicName}
          submissionImageUrl={
            currentSubmission?.thumbnailUrl || currentSubmission?.url
          }
          onViewModeChange={setViewMode}
        />
      </div>
    </VotingCarouselApiProvider>
  );
}
