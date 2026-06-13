'use client'

import { useTranslations } from 'next-intl'
import { Info, LayoutGrid, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VotingInfoDrawer } from '@/components/live/vote/voting-info-drawer'

interface FloatingTopBarProps {
  currentIndex: number
  totalCount: number
  currentFilter: number | null
  onClearFilter: () => void
  onShowGrid: () => void
  ratedCount: number
  reviewTotalCount: number
}

const glassButtonClass =
  'flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 active:scale-95'

export function FloatingTopBar({
  currentIndex,
  totalCount,
  currentFilter,
  onClearFilter,
  onShowGrid,
  ratedCount,
  reviewTotalCount,
}: FloatingTopBarProps) {
  const t = useTranslations('VotingViewerPage')
  const visibleCurrentIndex = totalCount > 0 ? currentIndex + 1 : 0
  const progress = totalCount > 0 ? ((currentIndex + 1) / totalCount) * 100 : 0

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      {/* Hairline progress along the very top edge */}
      <div className="h-0.5 w-full bg-white/15">
        <div
          className="h-full bg-white/80 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <VotingInfoDrawer votingInfo={{ rated: ratedCount, total: reviewTotalCount }}>
          <button
            type="button"
            className={cn(glassButtonClass, 'pointer-events-auto')}
            aria-label={t('infoDrawer.triggerLabel')}
          >
            <Info className="h-5 w-5" />
          </button>
        </VotingInfoDrawer>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-full bg-black/35 px-4 py-2 text-sm font-medium tabular-nums text-white backdrop-blur-md">
            {visibleCurrentIndex} / {totalCount}
          </div>
          {currentFilter !== null && (
            <button
              type="button"
              onClick={onClearFilter}
              className="flex items-center gap-1 rounded-full bg-amber-400/90 px-3 py-2 text-xs font-semibold text-zinc-950 backdrop-blur-md transition-colors hover:bg-amber-300"
              aria-label={t('emptyState.showAll')}
            >
              <Star className="h-3.5 w-3.5 fill-current" />
              {currentFilter}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onShowGrid}
          className={cn(glassButtonClass, 'pointer-events-auto')}
          aria-label={t('footer.showGrid')}
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
