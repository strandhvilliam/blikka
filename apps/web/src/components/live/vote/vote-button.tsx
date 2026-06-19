'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Heart } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PrimaryButton } from '@/components/ui/primary-button'
import {
  getThumbnailDisplaySource,
  SubmissionRawOriginalImage,
  SubmissionThumbnailImage,
} from '@/components/submission-image'

interface VoteButtonProps {
  isSelected: boolean
  isEnabled: boolean
  hasVoted: boolean
  isOwnSubmission?: boolean
  onVote: () => void
  showComplete?: boolean
  className?: string
  submissionTitle?: string
  thumbnailUrl?: string
  originalUrl?: string
}

export function VoteButton({
  isSelected,
  isEnabled,
  hasVoted,
  isOwnSubmission = false,
  onVote,
  className,
  submissionTitle,
  thumbnailUrl,
  originalUrl,
}: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const t = useTranslations('VotingViewerPage')
  const imageSource = getThumbnailDisplaySource({ thumbnailUrl, originalUrl })
  const isDisabled = !isEnabled || isSelected || hasVoted || isOwnSubmission
  const buttonLabel = isOwnSubmission
    ? t('voteButton.cannotVoteForYourself')
    : isSelected
      ? t('voteButton.yourVote')
      : hasVoted
        ? t('voteButton.alreadyVoted')
        : t('voteButton.voteForThisPhoto')

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <PrimaryButton
          disabled={isDisabled}
          className={cn('w-full rounded-full py-4 text-base', className)}
        >
          <Heart className={cn('h-5 w-5 transition-all', isSelected && 'fill-current')} />
          {buttonLabel}
        </PrimaryButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className="gap-4">
          <AlertDialogTitle className="font-gothic text-2xl font-medium tracking-tight">
            {t('voteButton.dialogTitle')}
          </AlertDialogTitle>
          {imageSource.kind !== 'missing' && (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
              {imageSource.kind === 'optimized-thumbnail' ? (
                <SubmissionThumbnailImage
                  src={imageSource.src}
                  alt={t('voteButton.imageAlt')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <SubmissionRawOriginalImage
                  src={imageSource.src}
                  alt={t('voteButton.imageAlt')}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          )}
          <AlertDialogDescription className="flex flex-col items-center gap-3">
            <span>{t('voteButton.dialogDescription')}</span>
            {submissionTitle && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                <span className="text-xs text-muted-foreground">
                  {t('voteButton.topicLabel')}
                </span>
                <span className="font-medium text-foreground">{submissionTitle}</span>
              </span>
            )}
            <span className="text-xs">{t('voteButton.cannotBeChanged')}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <AlertDialogCancel className="h-12 flex-1 rounded-full">
            {t('voteButton.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <PrimaryButton className="h-12 flex-1 rounded-full" onClick={onVote}>
              {t('voteButton.confirm')}
            </PrimaryButton>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
