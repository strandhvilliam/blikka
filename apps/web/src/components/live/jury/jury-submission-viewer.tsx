"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { parseAsInteger, useQueryState } from "nuqs"
import { ArrowLeft, ImageOff, Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  getFinalRankingLabel,
  getParticipantAssetUrl,
  getRankAssignments,
} from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-utils"
import { FullscreenImage } from "@/components/fullscreen-image"
import { ActiveRatingFilterBadge } from "./rating-filter"
import { JurySubmissionCompactNav } from "./jury-submission-compact-nav"
import { JurySidebar } from "./jury-sidebar"
import { useDomain } from "@/lib/domain-provider"
import { useJuryClientToken } from "./jury-client-token-provider"
import { useJuryViewerKeyboardShortcuts } from "@/hooks/use-jury-viewer-keyboard-shortcuts"
import { useJuryReviewData } from "./jury-review-data-provider"
import { useJuryLocalRatingSync } from "@/app/(marathon)/live/[domain]/jury/[token]/viewer/_hooks/use-jury-local-rating-sync"
import { useJuryNotesDebouncedSave } from "@/app/(marathon)/live/[domain]/jury/[token]/viewer/_hooks/use-jury-notes-debounced-save"
import { useJuryReviewQueryState } from "@/app/(marathon)/live/[domain]/jury/[token]/viewer/_hooks/use-jury-review-query-state"

export function JurySubmissionViewer({ initialIndex }: { initialIndex: number }) {
  const { selectedRatings, backToList } = useJuryReviewQueryState()
  const {
    participants,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalParticipants: totalParticipantsQuery,
  } = useJuryReviewData()
  const totalParticipants = totalParticipantsQuery?.value ?? participants.length
  const domain = useDomain()
  const token = useJuryClientToken()
  const trpc = useTRPC()
  const { data: invitation } = useSuspenseQuery(
    trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
  )
  const {
    data: { ratings },
  } = useSuspenseQuery(trpc.jury.getJuryRatingsByInvitation.queryOptions({ domain, token }))

  const ratingByParticipantId = useMemo(
    () => new Map(ratings.map((rating) => [rating.participantId, rating] as const)),
    [ratings],
  )
  const queryClient = useQueryClient()
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(initialIndex),
  )
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)

  const currentParticipant = participants[currentParticipantIndex] ?? participants[0] ?? null
  const currentParticipantId = currentParticipant?.id ?? null
  const currentAssetUrl = getParticipantAssetUrl(currentParticipant, invitation)
  const currentAssetId = String(currentParticipant?.submission?.id ?? currentParticipant?.id ?? "")

  const existingRating = useMemo(
    () =>
      currentParticipantId === null ? undefined : ratingByParticipantId.get(currentParticipantId),
    [currentParticipantId, ratingByParticipantId],
  )

  const {
    localRating,
    setLocalRating,
    localNotes,
    setLocalNotes,
    localFinalRanking,
    setLocalFinalRanking,
  } = useJuryLocalRatingSync({
    existingRating,
    ratings,
    currentParticipantId,
  })

  useEffect(() => {
    if (participants.length - currentParticipantIndex <= 4 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [currentParticipantIndex, participants.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  const invalidateJuryQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.jury.pathKey(),
    })
  }, [queryClient, trpc.jury])

  const createRatingMutation = useMutation(
    trpc.jury.createRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  )

  const updateRatingMutation = useMutation(
    trpc.jury.updateRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  )

  const deleteRatingMutation = useMutation(
    trpc.jury.deleteRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  )

  const saveRating = useCallback(
    async (nextRating: number, nextNotes: string, nextFinalRanking: 1 | 2 | 3 | null) => {
      if (!currentParticipantId) return

      setIsSaving(true)
      try {
        if (existingRating) {
          if (nextRating === 0 && !nextNotes.trim() && nextFinalRanking === null) {
            await deleteRatingMutation.mutateAsync({
              token,
              domain,
              participantId: currentParticipantId,
            })
          } else {
            await updateRatingMutation.mutateAsync({
              token,
              domain,
              participantId: currentParticipantId,
              rating: nextRating,
              notes: nextNotes,
              finalRanking: nextFinalRanking,
            })
          }
        } else if (nextRating > 0 || nextNotes.trim() || nextFinalRanking !== null) {
          await createRatingMutation.mutateAsync({
            token,
            domain,
            participantId: currentParticipantId,
            rating: nextRating,
            notes: nextNotes,
            finalRanking: nextFinalRanking,
          })
        }
      } catch (error) {
        console.error("Failed to save rating", error)
        toast.error("Failed to save review changes")
      } finally {
        setIsSaving(false)
      }
    },
    [
      createRatingMutation,
      currentParticipantId,
      deleteRatingMutation,
      domain,
      existingRating,
      token,
      updateRatingMutation,
    ],
  )

  const handleRatingClick = useCallback(
    (star: number) => {
      const nextRating = star === localRating ? 0 : star
      setLocalRating(nextRating)
      void saveRating(nextRating, localNotes, localFinalRanking)
    },
    [localFinalRanking, localNotes, localRating, saveRating, setLocalRating],
  )

  const [pendingRank, setPendingRank] = useState<1 | 2 | 3 | null>(null)

  const confirmFinalRanking = useCallback(() => {
    if (pendingRank === null) return
    const nextFinalRanking = localFinalRanking === pendingRank ? null : pendingRank
    setLocalFinalRanking(nextFinalRanking)
    void saveRating(localRating, localNotes, nextFinalRanking)
    setPendingRank(null)
  }, [pendingRank, localFinalRanking, localNotes, localRating, saveRating, setLocalFinalRanking])

  const handleFinalRankingClick = useCallback((finalRanking: 1 | 2 | 3) => {
    setPendingRank(finalRanking)
  }, [])

  const goToPrev = useCallback(() => {
    void setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1))
  }, [currentParticipantIndex, setCurrentParticipantIndex])

  const goToNext = useCallback(() => {
    void setCurrentParticipantIndex(Math.min(participants.length - 1, currentParticipantIndex + 1))
  }, [currentParticipantIndex, participants.length, setCurrentParticipantIndex])

  useJuryViewerKeyboardShortcuts({
    isFullscreenOpen,
    localRating,
    goToPrev,
    goToNext,
    onBack: backToList,
    onRatingClick: handleRatingClick,
  })

  const { handleNotesChange } = useJuryNotesDebouncedSave({
    localRating,
    localFinalRanking,
    saveRating,
    setLocalNotes,
  })

  const rankOccupants = useMemo(() => {
    const base = getRankAssignments(ratings)
    if (currentParticipantId) {
      for (const [rank, pid] of base) {
        if (pid === currentParticipantId) base.delete(rank)
      }
      if (localFinalRanking !== null) {
        base.set(localFinalRanking, currentParticipantId)
      }
    }
    return base
  }, [ratings, currentParticipantId, localFinalRanking])

  if (!currentParticipant) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white px-4 py-3">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-neutral-50 px-3 py-2 text-sm font-medium text-brand-black transition-colors hover:bg-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <ActiveRatingFilterBadge selectedRatings={selectedRatings} />
        </div>

        <div className="rounded-2xl border border-border/60 bg-white px-6 py-16 text-center">
          <p className="text-sm text-brand-gray">No participant selected.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <AlertDialog
        open={pendingRank !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRank(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRank !== null && localFinalRanking === pendingRank
                ? `Remove ${getFinalRankingLabel(pendingRank)} place?`
                : pendingRank !== null
                  ? `Assign ${getFinalRankingLabel(pendingRank)} place?`
                  : "Assign ranking"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRank !== null && localFinalRanking === pendingRank
                ? `This will remove #${currentParticipant.reference} from ${getFinalRankingLabel(pendingRank)} place.`
                : pendingRank !== null
                  ? `This will assign #${currentParticipant.reference} as your ${getFinalRankingLabel(pendingRank)} place pick.${
                      rankOccupants.has(pendingRank) &&
                      rankOccupants.get(pendingRank) !== currentParticipantId
                        ? ` The current ${getFinalRankingLabel(pendingRank)} place holder will be replaced.`
                        : ""
                    }`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFinalRanking}>
              {pendingRank !== null && localFinalRanking === pendingRank ? "Remove" : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
        <JurySubmissionCompactNav
          onBack={backToList}
          selectedRatings={selectedRatings}
          canOpenFullscreen={Boolean(currentAssetUrl && !imageErrors.has(currentAssetId))}
          onOpenFullscreen={() => setIsFullscreenOpen(true)}
          currentParticipantIndex={currentParticipantIndex}
          loadedParticipantCount={participants.length}
          visibleTotal={totalParticipants}
          onGoToPrev={goToPrev}
          onGoToNext={goToNext}
        />

        {/* Image + sidebar */}
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative flex min-h-[55vh] items-center justify-center bg-neutral-100 xl:min-h-[65vh]">
            {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
              <img
                src={currentAssetUrl}
                alt={currentParticipant.reference}
                className="max-h-[75vh] max-w-full object-contain"
                onError={() => setImageErrors((prev) => new Set(prev).add(currentAssetId))}
              />
            ) : (
              <div className="flex max-w-sm flex-col items-center justify-center px-6 text-center">
                <ImageOff className="mb-4 h-12 w-12 text-brand-gray/30" />
                <p className="font-gothic text-lg font-bold text-brand-black/60">
                  {invitation.inviteType === "class"
                    ? "Contact sheet unavailable"
                    : "Image unavailable"}
                </p>
                <p className="mt-2 text-sm text-brand-gray">
                  The asset could not be loaded for this participant.
                </p>
              </div>
            )}

            {isFetchingNextPage ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-white/80 px-3 py-1 text-xs text-brand-gray backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60 xl:border-l xl:border-t-0">
            <JurySidebar
              participant={currentParticipant}
              invitation={invitation}
              rating={localRating}
              notes={localNotes}
              isSaving={isSaving}
              onRatingClick={handleRatingClick}
              onNotesChange={handleNotesChange}
              localFinalRanking={localFinalRanking}
              rankOccupants={rankOccupants}
              currentParticipantId={currentParticipantId}
              participants={participants}
              onFinalRankingClick={handleFinalRankingClick}
            />
          </div>
        </div>
      </div>

      {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
        <FullscreenImage
          src={currentAssetUrl}
          alt={`Submission ${currentParticipant.reference}`}
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
        />
      ) : null}
    </>
  )
}
