'use client'

import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import {
  getOriginalViewerSource,
  SubmissionOptimizedOriginalImage,
  SubmissionThumbnailImage,
} from '@/components/submission-image'
import { isSubmissionInRenderWindow } from '@/components/live/vote/carousel-view'
import { useVotingCarouselApi } from '@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-carousel-api'
import { useVotingSearchParams } from '@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-search-params'
import type { VotingSubmission } from '@/lib/vote/voting-submission'

interface ImmersiveCarouselProps {
  submissions: VotingSubmission[]
  onTapImage?: () => void
}

export function ImmersiveCarousel({ submissions, onTapImage }: ImmersiveCarouselProps) {
  const { setApi } = useVotingCarouselApi()
  const { currentFilter, currentImageIndex } = useVotingSearchParams()

  return (
    <Carousel
      key={currentFilter ?? 'all'}
      setApi={setApi}
      opts={{
        align: 'center',
        loop: false,
      }}
      className="h-full w-full"
    >
      <CarouselContent className="-ml-0 h-full">
        {submissions.map((submission, index) => {
          const shouldRenderImage = isSubmissionInRenderWindow(index, currentImageIndex)
          const imageSource = getOriginalViewerSource({
            thumbnailUrl: submission.thumbnailUrl,
            originalUrl: submission.url,
          })
          const imageAlt = `photo-${submission.submissionId}`

          return (
            <CarouselItem key={submission.submissionId} className="h-full pl-0">
              {imageSource.kind !== 'missing' && shouldRenderImage ? (
                <button
                  type="button"
                  onClick={onTapImage}
                  className="flex h-full w-full cursor-default items-center justify-center"
                >
                  {imageSource.kind === 'optimized-original' ? (
                    <SubmissionOptimizedOriginalImage
                      src={imageSource.src}
                      alt={imageAlt}
                      priority={index === currentImageIndex}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <SubmissionThumbnailImage
                      src={imageSource.src}
                      alt={imageAlt}
                      priority={index === currentImageIndex}
                      className="h-full w-full object-contain"
                    />
                  )}
                </button>
              ) : imageSource.kind !== 'missing' ? (
                <div className="h-full w-full" aria-hidden />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-sm text-white/50">Image not available</span>
                </div>
              )}
            </CarouselItem>
          )
        })}
      </CarouselContent>
    </Carousel>
  )
}
