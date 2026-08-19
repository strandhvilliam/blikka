'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTRPC } from '@/lib/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { parseAsInteger, useQueryState } from 'nuqs'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Maximize2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getParticipantAssetUrl } from '@/lib/jury/jury-utils'
import { FullscreenImage } from '@/components/fullscreen-image'
import { ActiveRatingFilterBadge } from './rating-filter'
import { JurySubmissionCompactNav } from './jury-submission-compact-nav'
import { JurySidebar, type JurySidebarShortlistState } from './jury-sidebar'
import { useDomain } from '@/lib/domain-provider'
import { useJuryClientToken } from './jury-client-token-provider'
import { useJuryViewerKeyboardShortcuts } from '@/hooks/live/jury/use-jury-viewer-keyboard-shortcuts'
import { useJuryReviewData } from './jury-review-data-provider'
import { useJuryLocalRatingSync } from '@/hooks/live/jury/use-jury-local-rating-sync'
import { useJuryNotesDebouncedSave } from '@/hooks/live/jury/use-jury-notes-debounced-save'
import { useJuryReviewQueryState } from '@/hooks/live/jury/use-jury-review-query-state'
import { useJuryShortlist } from '@/hooks/live/jury/use-jury-shortlist'
import { useJurySubmissionPreload } from '@/hooks/live/jury/use-jury-submission-preload'
import { useJuryNavThrottle, type JuryNavDirection } from '@/hooks/live/jury/use-jury-nav-throttle'
import { JurySubmissionPhoto } from './jury-submission-photo'
import { JuryFullscreenLabel, JuryFullscreenOverlay } from './jury-fullscreen-overlay'

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
    'index',
    parseAsInteger.withDefault(initialIndex),
  )
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  /** Dialogs have to portal into the fullscreened element — nothing outside it paints. */
  const [fullscreenContainer, setFullscreenContainer] = useState<HTMLElement | null>(null)

  const activeIndex = participants[currentParticipantIndex] ? currentParticipantIndex : 0
  const currentParticipant = participants[activeIndex] ?? null
  const currentParticipantId = currentParticipant?.id ?? null
  const currentAssetUrl = getParticipantAssetUrl(currentParticipant, invitation)
  const currentAssetId = String(currentParticipant?.submission?.id ?? currentParticipant?.id ?? '')

  const canOpenFullscreen = Boolean(currentAssetUrl && !imageErrors.has(currentAssetId))
  const canGoToPrev = currentParticipantIndex > 0
  const canGoToNext = currentParticipantIndex < participants.length - 1

  const assetUrls = useMemo(
    () => participants.map((participant) => getParticipantAssetUrl(participant, invitation)),
    [participants, invitation],
  )

  useJurySubmissionPreload({
    assetUrls,
    activeIndex,
    isContactSheet: invitation.inviteType === 'class',
  })

  const existingRating = useMemo(
    () =>
      currentParticipantId === null ? undefined : ratingByParticipantId.get(currentParticipantId),
    [currentParticipantId, ratingByParticipantId],
  )

  const { localRating, setLocalRating, localNotes, setLocalNotes } = useJuryLocalRatingSync({
    existingRating,
    currentParticipantId,
  })

  const {
    picks,
    shortlistedIds,
    winnerParticipantId,
    count: shortlistCount,
    requiredSize,
    isFull,
    isSaving: isSavingShortlist,
    setPick,
    setWinner,
    pickWinner,
  } = useJuryShortlist({ domain, token })

  const isShortlisted = currentParticipantId !== null && shortlistedIds.has(currentParticipantId)
  const isWinner = currentParticipantId !== null && winnerParticipantId === currentParticipantId
  const winnerReference = picks.find((pick) => pick.isWinner)?.reference ?? null

  useEffect(() => {
    if (participants.length - currentParticipantIndex <= 4 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [currentParticipantIndex, participants.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  const invalidateJuryRepository = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.jury.pathKey(),
    })
  }, [queryClient, trpc.jury])

  const createRatingMutation = useMutation(
    trpc.jury.createRating.mutationOptions({
      onSettled: invalidateJuryRepository,
    }),
  )

  const updateRatingMutation = useMutation(
    trpc.jury.updateRating.mutationOptions({
      onSettled: invalidateJuryRepository,
    }),
  )

  const deleteRatingMutation = useMutation(
    trpc.jury.deleteRating.mutationOptions({
      onSettled: invalidateJuryRepository,
    }),
  )

  const saveRating = useCallback(
    async (nextRating: number, nextNotes: string) => {
      if (!currentParticipantId) return

      setIsSaving(true)
      try {
        if (existingRating) {
          if (nextRating === 0 && !nextNotes.trim()) {
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
            })
          }
        } else if (nextRating > 0 || nextNotes.trim()) {
          await createRatingMutation.mutateAsync({
            token,
            domain,
            participantId: currentParticipantId,
            rating: nextRating,
            notes: nextNotes,
          })
        }
      } catch (error) {
        console.error('Failed to save rating', error)
        toast.error('Failed to save review changes')
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
      void saveRating(nextRating, localNotes)
    },
    [localNotes, localRating, saveRating, setLocalRating],
  )

  const currentReference = currentParticipant?.reference

  const handleToggleShortlist = useCallback(() => {
    if (currentParticipantId === null) return
    void setPick(currentParticipantId, !isShortlisted, currentReference)
  }, [currentParticipantId, currentReference, isShortlisted, setPick])

  /** Only changes that overwrite or drop an existing winner need confirming. */
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false)

  const handleWinnerClick = useCallback(() => {
    if (currentParticipantId === null) return

    if (isWinner || winnerParticipantId !== null) {
      setIsWinnerDialogOpen(true)
      return
    }

    void pickWinner(currentParticipantId, currentReference)
  }, [currentParticipantId, currentReference, isWinner, pickWinner, winnerParticipantId])

  const confirmWinnerChange = useCallback(() => {
    if (currentParticipantId === null) return
    void (isWinner
      ? setWinner(null, currentReference)
      : pickWinner(currentParticipantId, currentReference))
    setIsWinnerDialogOpen(false)
  }, [currentParticipantId, currentReference, isWinner, pickWinner, setWinner])

  /** Stepping off the previous index rather than the rendered one keeps queued steps from stacking. */
  const stepParticipant = useCallback(
    (direction: JuryNavDirection) => {
      void setCurrentParticipantIndex((prev) =>
        Math.min(participants.length - 1, Math.max(0, prev + direction)),
      )
    },
    [participants.length, setCurrentParticipantIndex],
  )

  const { goToPrev, goToNext } = useJuryNavThrottle({ onStep: stepParticipant })

  /** One pick state for both surfaces, so the sidebar and the fullscreen bar cannot drift. */
  const shortlistState: JurySidebarShortlistState = useMemo(
    () => ({
      isShortlisted,
      isWinner,
      shortlistCount,
      requiredSize,
      isFull,
      isSavingShortlist,
      onToggleShortlist: handleToggleShortlist,
      onWinnerClick: handleWinnerClick,
    }),
    [
      handleToggleShortlist,
      handleWinnerClick,
      isFull,
      isSavingShortlist,
      isShortlisted,
      isWinner,
      requiredSize,
      shortlistCount,
    ],
  )

  const toggleFullscreen = useCallback(() => {
    setIsFullscreenOpen((open) => (open ? false : canOpenFullscreen))
  }, [canOpenFullscreen])

  /** Paging onto a submission with no viewable asset would tear the viewer out of fullscreen. */
  useEffect(() => {
    if (isFullscreenOpen && !canOpenFullscreen) {
      setIsFullscreenOpen(false)
    }
  }, [canOpenFullscreen, isFullscreenOpen])

  useJuryViewerKeyboardShortcuts({
    isFullscreenOpen,
    canOpenFullscreen,
    localRating,
    goToPrev,
    goToNext,
    onBack: backToList,
    onRatingClick: handleRatingClick,
    onToggleShortlist: handleToggleShortlist,
    onWinnerClick: handleWinnerClick,
    onToggleFullscreen: toggleFullscreen,
  })

  const { handleNotesChange } = useJuryNotesDebouncedSave({
    localRating,
    saveRating,
    setLocalNotes,
  })

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
      <AlertDialog open={isWinnerDialogOpen} onOpenChange={setIsWinnerDialogOpen}>
        <AlertDialogContent portalContainer={fullscreenContainer}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isWinner ? 'Remove your winner?' : 'Replace your winner?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isWinner
                ? `This will leave #${currentParticipant.reference} on your shortlist without the win, and your review will have no winner.`
                : `This will make #${currentParticipant.reference} your winner${
                    isShortlisted ? '' : ', adding it to your shortlist'
                  }. #${winnerReference ?? ''} loses the win but stays shortlisted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWinnerChange}>
              {isWinner ? 'Remove' : 'Make winner'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
        <JurySubmissionCompactNav
          onBack={backToList}
          selectedRatings={selectedRatings}
          canOpenFullscreen={canOpenFullscreen}
          onOpenFullscreen={() => setIsFullscreenOpen(true)}
          currentParticipantIndex={currentParticipantIndex}
          loadedParticipantCount={participants.length}
          visibleTotal={totalParticipants}
          onGoToPrev={goToPrev}
          onGoToNext={goToNext}
        />

        {/* Image + sidebar */}
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="group relative flex min-h-[55vh] items-center justify-center bg-neutral-100 xl:min-h-[65vh]">
            <JurySubmissionPhoto
              key={currentAssetId}
              src={imageErrors.has(currentAssetId) ? undefined : currentAssetUrl}
              alt={currentParticipant.reference}
              isContactSheet={invitation.inviteType === 'class'}
              onError={() => setImageErrors((prev) => new Set(prev).add(currentAssetId))}
            />

            {canOpenFullscreen ? (
              <button
                type="button"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white/85 text-brand-black opacity-100 shadow-sm backdrop-blur-sm transition-all hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                onClick={() => setIsFullscreenOpen(true)}
                title="Fullscreen (F)"
                aria-label="View image fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            ) : null}

            {canGoToPrev ? (
              <button
                type="button"
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-white/85 text-brand-black opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-white group-hover:opacity-100"
                onClick={goToPrev}
                aria-label="Previous submission"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            {canGoToNext ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-white/85 text-brand-black opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-white group-hover:opacity-100"
                onClick={goToNext}
                aria-label="Next submission"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            {isFetchingNextPage ? (
              <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-border/60 bg-white/80 px-3 py-1 text-xs text-brand-gray backdrop-blur-sm">
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
              shortlist={shortlistState}
            />
          </div>
        </div>
      </div>

      {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
        <FullscreenImage
          src={currentAssetUrl}
          alt={`Submission ${currentParticipant.reference}`}
          sourceKind={invitation.inviteType === 'class' ? 'raw' : 'original'}
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
          onContainerChange={setFullscreenContainer}
          onPrev={goToPrev}
          onNext={goToNext}
          hasPrev={canGoToPrev}
          hasNext={canGoToNext}
          label={
            <JuryFullscreenLabel
              participant={currentParticipant}
              invitation={invitation}
              isSaving={isSaving || isSavingShortlist}
            />
          }
          overlay={
            <JuryFullscreenOverlay
              rating={localRating}
              onRatingClick={handleRatingClick}
              hasNotes={localNotes.trim().length > 0}
              shortlist={shortlistState}
              currentParticipantIndex={currentParticipantIndex}
              loadedParticipantCount={participants.length}
              visibleTotal={totalParticipants}
              isFetchingNextPage={isFetchingNextPage}
              onGoToPrev={goToPrev}
              onGoToNext={goToNext}
            />
          }
        />
      ) : null}
    </>
  )
}
