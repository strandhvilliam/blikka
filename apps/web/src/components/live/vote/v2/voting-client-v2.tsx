'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDomainPathname } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ImmersiveCarousel } from './immersive-carousel'
import { FloatingTopBar } from './floating-top-bar'
import { ActionDock } from './action-dock'
import { GridOverlay } from './grid-overlay'
import { useVotingState } from '@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-state'
import { useVotingSearchParams } from '@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-search-params'
import {
  useVotingCarouselApi,
  VotingCarouselApiProvider,
} from '@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-carousel-api'
import { useClientReady } from '@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-client-ready'

export function VotingClientV2({ domain, token }: { domain: string; token: string }) {
  return (
    <VotingCarouselApiProvider>
      <VotingClientV2Inner domain={domain} token={token} />
    </VotingCarouselApiProvider>
  )
}

function VotingClientV2Inner({ domain, token }: { domain: string; token: string }) {
  const trpc = useTRPC()
  const router = useRouter()
  const isClientReady = useClientReady()
  const t = useTranslations('VotingViewerPage')
  const [isChromeVisible, setIsChromeVisible] = useState(true)

  const submitVoteMutation = useMutation(trpc.voting.submitVote.mutationOptions())

  const { currentImageIndex, viewMode, setViewMode, currentFilter, setParams } =
    useVotingSearchParams()
  const { isNavigatingRef } = useVotingCarouselApi()

  const {
    isLoading,
    selectedSubmissionId,
    setRating,
    setSelectedSubmission,
    getRating,
    getFilteredSubmissions,
    stats,
  } = useVotingState({ domain, token })

  const filteredSubmissions = getFilteredSubmissions(currentFilter)
  const currentSubmission = filteredSubmissions[currentImageIndex]
  const isOwnSubmission = currentSubmission?.isOwnSubmission ?? false
  const currentRating =
    currentSubmission && !currentSubmission.isOwnSubmission
      ? getRating(currentSubmission.submissionId)
      : undefined
  const isSelected = currentSubmission
    ? currentSubmission.submissionId === selectedSubmissionId
    : false
  const hasImages = filteredSubmissions.length > 0

  const handleRatingChange = (rating: number) => {
    if (!currentSubmission || currentSubmission.isOwnSubmission) return
    setRating(currentSubmission.submissionId, rating)
    toast.success(t('starRating.ratedToast', { rating }), {
      duration: 1000,
      position: 'top-center',
    })
  }

  const handleFilterChange = (filter: number | null) => {
    setParams({ filter, image: 0 })
  }

  const handleGridSelect = (index: number) => {
    isNavigatingRef.current = true
    setParams({ image: index, view: 'carousel' })
    setTimeout(() => {
      isNavigatingRef.current = false
    }, 100)
  }

  const handleVote = async () => {
    if (!currentSubmission) return

    if (currentSubmission.isOwnSubmission) {
      toast.error(t('toasts.cannotVoteForOwn'))
      return
    }

    if (!token || !domain) {
      toast.error(t('toasts.missingSessionInfo'))
      return
    }

    try {
      const result = await submitVoteMutation.mutateAsync({
        token,
        submissionId: currentSubmission.submissionId,
      })

      if (result.success) {
        setSelectedSubmission(currentSubmission.submissionId)
        toast.success(t('toasts.voteSubmitted'))
        router.push(formatDomainPathname(`/live/vote/${token}/completed`, domain, 'live'))
      } else if (result.error === 'already_voted') {
        toast.error(t('toasts.alreadyVoted'))
        router.push(formatDomainPathname(`/live/vote/${token}/completed`, domain, 'live'))
      } else if (result.error === 'cannot_vote_for_self') {
        toast.error(t('toasts.cannotVoteForOwn'))
      }
    } catch (error) {
      toast.error(t('toasts.submitFailed'))
      console.error('Vote submission error:', error)
    }
  }

  if (!isClientReady || isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-zinc-950">
        <Skeleton className="h-2/3 w-[90%] max-w-2xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-zinc-950 text-white">
      {hasImages ? (
        <ImmersiveCarousel
          submissions={filteredSubmissions}
          onTapImage={() => setIsChromeVisible((visible) => !visible)}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-base font-medium text-white">{t('emptyState.title')}</p>
          <p className="text-sm text-white/60">
            {currentFilter !== null
              ? t('emptyState.filteredDescription', { rating: currentFilter })
              : t('emptyState.defaultDescription')}
          </p>
          {currentFilter !== null && (
            <button
              type="button"
              onClick={() => handleFilterChange(null)}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              {t('emptyState.showAll')}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {isChromeVisible && (
          <motion.div
            key="chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Scrims keep floating chrome legible over bright photos */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 bg-gradient-to-t from-black/70 to-transparent" />

            <FloatingTopBar
              currentIndex={currentImageIndex}
              totalCount={filteredSubmissions.length}
              currentFilter={currentFilter}
              onClearFilter={() => handleFilterChange(null)}
              onShowGrid={() => setViewMode('grid')}
              ratedCount={stats.rated}
              reviewTotalCount={stats.total}
            />

            {hasImages && (
              <ActionDock
                currentRating={currentRating}
                onRatingChange={handleRatingChange}
                isOwnSubmission={isOwnSubmission}
                isSelected={isSelected}
                hasVoted={!!selectedSubmissionId}
                hasImages={hasImages}
                onVote={handleVote}
                submissionTitle={currentSubmission?.topicName}
                submissionThumbnailUrl={currentSubmission?.thumbnailUrl}
                submissionOriginalUrl={currentSubmission?.url}
              />
            )}

            {hasImages && (
              <DesktopArrows
                currentImageIndex={currentImageIndex}
                totalCount={filteredSubmissions.length}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewMode === 'grid' && (
          <GridOverlay
            key="grid"
            submissions={filteredSubmissions}
            currentImageIndex={currentImageIndex}
            selectedSubmissionId={selectedSubmissionId}
            getRating={getRating}
            ratingCounts={stats.ratingCounts}
            totalReviewCount={stats.total}
            currentFilter={currentFilter}
            onFilterChange={handleFilterChange}
            onSelectIndex={handleGridSelect}
            onClose={() => setViewMode('carousel')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const arrowClass =
  'pointer-events-auto hidden h-12 w-12 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-30 sm:flex'

function DesktopArrows({
  currentImageIndex,
  totalCount,
}: {
  currentImageIndex: number
  totalCount: number
}) {
  const { api } = useVotingCarouselApi()
  const t = useTranslations('VotingViewerPage')

  return (
    <div className="pointer-events-none absolute inset-x-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between">
      <button
        type="button"
        onClick={() => api?.scrollPrev()}
        disabled={currentImageIndex === 0}
        className={arrowClass}
        aria-label={t('footer.previousPhoto')}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={() => api?.scrollNext()}
        disabled={currentImageIndex >= totalCount - 1}
        className={arrowClass}
        aria-label={t('footer.nextPhoto')}
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  )
}
