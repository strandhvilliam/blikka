'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { GalleryPhoto } from './gallery-photo'
import { GalleryLightbox } from './gallery-lightbox'
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

  useEffect(() => {
    setActiveIndex(null)
  }, [topicFilter, classFilter, fixedTopicOrderIndex])

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
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      {showFilters && (topics.length > 0 || competitionClasses.length > 0) ? (
        <div className="relative sticky top-0 z-20 -mx-4 mb-6 border-b border-white/5 bg-black/70 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {topics.length > 0 ? (
              <FilterScroller label="Topics">
                <FilterChip
                  active={topicFilter === null}
                  disabled={isFilterLoading}
                  onClick={() => setTopicFilter(null)}
                  label="All"
                />
                {topics.map((topic) => (
                  <FilterChip
                    key={topic.id}
                    active={topicFilter === topic.orderIndex}
                    disabled={isFilterLoading}
                    onClick={() => setTopicFilter(topic.orderIndex)}
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
                  onClick={() => setClassFilter(null)}
                  label="All"
                />
                {competitionClasses.map((competitionClass) => (
                  <FilterChip
                    key={competitionClass.id}
                    active={classFilter === competitionClass.id}
                    disabled={isFilterLoading}
                    onClick={() => setClassFilter(competitionClass.id)}
                    label={competitionClass.name}
                  />
                ))}
              </FilterScroller>
            ) : null}

            {isFilterLoading ? (
              <span
                role="status"
                aria-live="polite"
                className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
              >
                <Spinner className="size-3 text-neutral-400" />
                Updating
              </span>
            ) : null}
          </div>

          {isFilterLoading ? (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-white/5"
            >
              <div className="h-full w-1/3 animate-[gallery-filter-progress_1.4s_ease-in-out_infinite] bg-white/50" />
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
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map((photo, index) => (
              <GalleryPhoto
                key={photo.submissionId}
                photo={photo}
                priority={index < priorityCount}
                onSelect={() => setActiveIndex(index)}
              />
            ))}
          </div>
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
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
        {label}
      </span>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-white/80 bg-white text-black'
          : 'border-white/15 text-neutral-300 hover:border-white/40 hover:text-white',
        disabled && 'cursor-wait opacity-60 hover:border-white/15 hover:text-neutral-300',
      )}
    >
      {label}
    </button>
  )
}

function PhotoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 15 }).map((_, index) => (
        <div key={index} className="aspect-square w-full animate-pulse rounded-sm bg-neutral-900" />
      ))}
    </div>
  )
}
