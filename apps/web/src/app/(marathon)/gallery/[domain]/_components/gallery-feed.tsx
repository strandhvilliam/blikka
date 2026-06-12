'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'
import { GalleryPhoto } from './gallery-photo'
import { GalleryLightbox } from './gallery-lightbox'
import { JustifiedGrid } from './justified-grid'
import { SectionHeading } from './gallery-chrome'
import { getGalleryFeedNextPageParam } from '../_lib/gallery-image'
import type { GalleryClassMeta, GalleryPhotoCard, GalleryTopicMeta } from '../_lib/types'

export function GalleryFeed({
  domain,
  topics,
  competitionClasses,
  fixedTopicOrderIndex,
  priorityCount = 10,
  showFilters = true,
}: {
  domain: string
  topics: GalleryTopicMeta[]
  competitionClasses: GalleryClassMeta[]
  fixedTopicOrderIndex?: number
  priorityCount?: number
  showFilters?: boolean
}) {
  const trpc = useTRPC()
  const [topicFilter, setTopicFilter] = useState<number | null>(fixedTopicOrderIndex ?? null)
  const [classFilter, setClassFilter] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isFetching,
    isPlaceholderData,
    isError,
  } = useInfiniteQuery(
    trpc.gallery.getGalleryFeed.infiniteQueryOptions(
      {
        domain,
        topicOrderIndex: fixedTopicOrderIndex ?? topicFilter,
        competitionClassId: classFilter,
      },
      {
        getNextPageParam: getGalleryFeedNextPageParam,
        placeholderData: keepPreviousData,
      },
    ),
  )

  const photos = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page.items) as GalleryPhotoCard[],
    [data?.pages],
  )

  const isFilterLoading = isPlaceholderData && isFetching && !isFetchingNextPage

  // Changing any filter resets the open lightbox so a stale index can't point past the
  // refetched page. Setters from useState are stable, so the empty dep array is safe.
  const applyFilter = useCallback(
    (setFilter: (value: number | null) => void, value: number | null) => {
      setFilter(value)
      setActiveIndex(null)
    },
    [],
  )

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage && !isFilterLoading) {
        void fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, isFilterLoading],
  )

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(onIntersect, { rootMargin: '600px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onIntersect])

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
      <SectionHeading title="All photos" size="lg" />

      {showFilters && (topics.length > 0 || competitionClasses.length > 0) ? (
        <div className="relative sticky top-16 z-20 -mx-4 mb-5 border-b border-white/10 bg-[var(--gallery-bg)] px-4 py-3.5 sm:-mx-6 sm:mb-6 sm:px-6">
          <div className="flex flex-col gap-4">
            {topics.length > 0 ? (
              <FilterScroller label="Topics">
                <FilterChip
                  active={topicFilter === null}
                  disabled={isFilterLoading}
                  onClick={() => applyFilter(setTopicFilter, null)}
                  label="All"
                />
                {topics.map((topic) => (
                  <FilterChip
                    key={topic.id}
                    active={topicFilter === topic.orderIndex}
                    disabled={isFilterLoading}
                    onClick={() => applyFilter(setTopicFilter, topic.orderIndex)}
                    label={topic.name}
                  />
                ))}
              </FilterScroller>
            ) : null}

            {competitionClasses.length > 0 ? (
              <FilterScroller label="Classes">
                <FilterChip
                  active={classFilter === null}
                  disabled={isFilterLoading}
                  onClick={() => applyFilter(setClassFilter, null)}
                  label="All"
                />
                {competitionClasses.map((competitionClass) => (
                  <FilterChip
                    key={competitionClass.id}
                    active={classFilter === competitionClass.id}
                    disabled={isFilterLoading}
                    onClick={() => applyFilter(setClassFilter, competitionClass.id)}
                    label={competitionClass.name}
                  />
                ))}
              </FilterScroller>
            ) : null}
          </div>

          {/* Loading is signalled by this red sweep plus the grid dimming below. */}
          {isFilterLoading ? (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-white/5"
            >
              <div className="h-full w-1/3 animate-[gallery-filter-progress_1.4s_ease-in-out_infinite] bg-white/60" />
            </div>
          ) : null}
        </div>
      ) : null}

      {isError ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          Something went wrong loading this gallery.
        </p>
      ) : isPending ? (
        <PhotoGridSkeleton />
      ) : photos.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">No photos to show yet.</p>
      ) : (
        <div
          className={cn(
            'relative transition-[opacity,filter] duration-300',
            isFilterLoading && 'pointer-events-none opacity-45 blur-[1px]',
          )}
          aria-busy={isFilterLoading}
        >
          <JustifiedGrid hasMore={hasNextPage}>
            {photos.map((photo, index) => (
              <GalleryPhoto
                key={photo.submissionId}
                photo={photo}
                priority={index < priorityCount}
                onSelect={() => setActiveIndex(index)}
              />
            ))}
          </JustifiedGrid>
        </div>
      )}

      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {isFetchingNextPage ? (
        <p className="py-8 text-center text-xs uppercase tracking-widest text-neutral-600">
          Loading more
        </p>
      ) : null}

      <GalleryLightbox
        photos={photos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
      />
    </section>
  )
}

function FilterScroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <div
        role="group"
        aria-label={`${label} filter options`}
        className="flex flex-wrap items-center gap-2"
      >
        {children}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-10 shrink-0 touch-manipulation items-center whitespace-nowrap rounded-full border px-4 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        active
          ? 'border-brand-primary bg-brand-primary text-brand-white'
          : 'border-white/15 text-neutral-300 hover:border-white/40 hover:text-white',
        disabled && 'cursor-wait opacity-60 hover:border-white/15 hover:text-neutral-300',
      )}
    >
      {label}
    </button>
  )
}

// Aspect ratios that echo a real justified layout while loading.
const SKELETON_ASPECTS = [1.5, 0.75, 1, 1.33, 0.8, 1.6, 1, 0.67, 1.4, 1, 1.2, 0.85, 1.5, 1, 0.7]

function PhotoGridSkeleton() {
  return (
    <JustifiedGrid>
      {SKELETON_ASPECTS.map((aspect, index) => (
        <div
          key={index}
          style={{ flexGrow: aspect, flexBasis: `calc(var(--gallery-row-h) * ${aspect})` }}
          className="h-[var(--gallery-row-h)] min-w-0 animate-pulse bg-white/[0.04]"
        />
      ))}
    </JustifiedGrid>
  )
}
