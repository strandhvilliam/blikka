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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { parseAsInteger, useQueryState } from "nuqs"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
  Maximize2,
} from "lucide-react"
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import type {
  JuryInvitation,
  JuryRatingsResponse,
} from "../../_lib/jury-types"
import {
  juryRankChipActive,
  juryRankChipNeutralOccupied,
  juryRankChipNeutralSlot,
} from "../_lib/jury-rank-chip-classes"
import {
  getFinalRankingLabel,
  getParticipantFinalRanking,
  getRankAssignments,
} from "../_lib/jury-final-ranking-state"
import type { JuryListParticipant } from "../_lib/jury-list-participant"
import { getParticipantAssetUrl } from "../_lib/jury-list-participant"
import { FullscreenImage } from "@/components/fullscreen-image"
import { ActiveRatingFilterBadge } from "./rating-filter"
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge"
import { JurySidebar } from "./jury-sidebar"

export function JurySubmissionViewer({
  domain,
  token,
  invitation,
  participants,
  initialIndex,
  selectedRatings,
  ratings,
  totalParticipants,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  ratingByParticipantId,
  onBack,
}: {
  domain: string
  token: string
  invitation: JuryInvitation
  participants: JuryListParticipant[]
  initialIndex: number
  selectedRatings: number[]
  ratings: JuryRatingsResponse["ratings"]
  totalParticipants: number
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  ratingByParticipantId: Map<number, JuryRatingsResponse["ratings"][number]>
  onBack: () => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(initialIndex),
  )
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)

  const currentParticipant =
    participants[currentParticipantIndex] ?? participants[0] ?? null

  const currentParticipantId = currentParticipant?.id ?? null
  const currentAssetUrl = getParticipantAssetUrl(
    currentParticipant,
    invitation,
  )
  const currentAssetId = String(
    currentParticipant?.submission?.id ?? currentParticipant?.id ?? "",
  )

  const existingRating = useMemo(
    () =>
      currentParticipantId === null
        ? undefined
        : ratingByParticipantId.get(currentParticipantId),
    [currentParticipantId, ratingByParticipantId],
  )

  const [localRating, setLocalRating] = useState(existingRating?.rating ?? 0)
  const [localNotes, setLocalNotes] = useState(existingRating?.notes ?? "")
  const [localFinalRanking, setLocalFinalRanking] = useState<1 | 2 | 3 | null>(
    getParticipantFinalRanking(ratings, currentParticipantId ?? -1),
  )
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalRating(existingRating?.rating ?? 0)
    setLocalNotes(existingRating?.notes ?? "")
    setLocalFinalRanking(
      getParticipantFinalRanking(ratings, currentParticipantId ?? -1),
    )
  }, [existingRating, currentParticipantId])

  useEffect(() => {
    if (
      participants.length - currentParticipantIndex <= 4 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    currentParticipantIndex,
    participants.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }
    }
  }, [])

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
    async (
      nextRating: number,
      nextNotes: string,
      nextFinalRanking: 1 | 2 | 3 | null,
    ) => {
      if (!currentParticipantId) return

      setIsSaving(true)
      try {
        if (existingRating) {
          if (
            nextRating === 0 &&
            !nextNotes.trim() &&
            nextFinalRanking === null
          ) {
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
        } else if (
          nextRating > 0 ||
          nextNotes.trim() ||
          nextFinalRanking !== null
        ) {
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
    [localFinalRanking, localNotes, localRating, saveRating],
  )

  const [pendingRank, setPendingRank] = useState<1 | 2 | 3 | null>(null)

  const confirmFinalRanking = useCallback(() => {
    if (pendingRank === null) return
    const nextFinalRanking =
      localFinalRanking === pendingRank ? null : pendingRank
    setLocalFinalRanking(nextFinalRanking)
    void saveRating(localRating, localNotes, nextFinalRanking)
    setPendingRank(null)
  }, [pendingRank, localFinalRanking, localNotes, localRating, saveRating])

  const handleFinalRankingClick = useCallback(
    (finalRanking: 1 | 2 | 3) => {
      setPendingRank(finalRanking)
    },
    [],
  )

  const goToPrev = useCallback(() => {
    void setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1))
  }, [currentParticipantIndex, setCurrentParticipantIndex])

  const goToNext = useCallback(() => {
    void setCurrentParticipantIndex(
      Math.min(participants.length - 1, currentParticipantIndex + 1),
    )
  }, [currentParticipantIndex, participants.length, setCurrentParticipantIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFullscreenOpen) return

      if (
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLInputElement
      ) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault()
          goToPrev()
          break
        case "ArrowRight":
          event.preventDefault()
          goToNext()
          break
        case "Escape":
          event.preventDefault()
          onBack()
          break
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          event.preventDefault()
          handleRatingClick(Number(event.key))
          break
        case "]":
          event.preventDefault()
          handleRatingClick(Math.min(5, localRating + 1))
          break
        case "[":
          event.preventDefault()
          handleRatingClick(Math.max(0, localRating - 1))
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    goToPrev,
    goToNext,
    handleRatingClick,
    onBack,
    localRating,
    isFullscreenOpen,
  ])

  const handleNotesChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextNotes = event.target.value
      setLocalNotes(nextNotes)

      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }

      notesTimeoutRef.current = setTimeout(() => {
        void saveRating(localRating, nextNotes, localFinalRanking)
      }, 800)
    },
    [localFinalRanking, localRating, saveRating],
  )

  if (!currentParticipant) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onBack}
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

  const visibleTotal = totalParticipants

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
                      rankOccupants.has(pendingRank) && rankOccupants.get(pendingRank) !== currentParticipantId
                        ? ` The current ${getFinalRankingLabel(pendingRank)} place holder will be replaced.`
                        : ""
                    }`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFinalRanking}>
              {pendingRank !== null && localFinalRanking === pendingRank
                ? "Remove"
                : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
        {/* Compact navigation bar */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-brand-black transition-colors hover:bg-neutral-100"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <ActiveRatingFilterBadge selectedRatings={selectedRatings} />
          </div>

          <div className="flex items-center gap-2">
            {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
              <button
                type="button"
                className="hidden h-8 w-8 items-center justify-center rounded-full border border-border/60 text-brand-black transition-colors hover:bg-neutral-50 md:flex"
                onClick={() => setIsFullscreenOpen(true)}
                title="Fullscreen"
                aria-label="View image fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-brand-black transition-colors hover:bg-neutral-50 disabled:opacity-30"
              disabled={currentParticipantIndex === 0}
              onClick={goToPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-gothic text-sm font-bold tabular-nums text-brand-black">
              {currentParticipantIndex + 1}
              <span className="font-sans font-normal text-brand-gray">
                {" / "}
                {visibleTotal}
              </span>
            </span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-brand-black transition-colors hover:bg-neutral-50 disabled:opacity-30"
              disabled={currentParticipantIndex >= participants.length - 1}
              onClick={goToNext}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image + sidebar */}
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative flex min-h-[55vh] items-center justify-center bg-neutral-100 xl:min-h-[65vh]">
            {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
              <img
                src={currentAssetUrl}
                alt={currentParticipant.reference}
                className="max-h-[75vh] max-w-full object-contain"
                onError={() =>
                  setImageErrors((prev) => new Set(prev).add(currentAssetId))
                }
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
