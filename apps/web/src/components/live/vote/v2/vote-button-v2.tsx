'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Heart } from 'lucide-react'
import { motion } from 'motion/react'
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

interface VoteButtonV2Props {
  isSelected: boolean
  isEnabled: boolean
  hasVoted: boolean
  isOwnSubmission?: boolean
  onVote: () => void
  className?: string
  submissionTitle?: string
  thumbnailUrl?: string
  originalUrl?: string
}

export function VoteButtonV2({
  isSelected,
  isEnabled,
  hasVoted,
  isOwnSubmission = false,
  onVote,
  className,
  submissionTitle,
  thumbnailUrl,
  originalUrl,
}: VoteButtonV2Props) {
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
        <motion.button
          type="button"
          disabled={isDisabled}
          whileTap={isDisabled ? undefined : { scale: 0.97 }}
          className={cn(
            'flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors',
            isDisabled
              ? 'bg-white/10 text-white/40 backdrop-blur-md'
              : 'bg-white text-zinc-950 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:bg-white/90',
            className,
          )}
        >
          <Heart
            className={cn('h-5 w-5 transition-all', isSelected && 'fill-red-500 text-red-500')}
          />
          {buttonLabel}
        </motion.button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('voteButton.dialogTitle')}</AlertDialogTitle>
          {imageSource.kind !== 'missing' && (
            <div className="max-h-32 overflow-hidden rounded-xl bg-muted aspect-video">
              {imageSource.kind === 'optimized-thumbnail' ? (
                <SubmissionThumbnailImage
                  src={imageSource.src}
                  alt={t('voteButton.imageAlt')}
                  className="h-full w-full object-contain"
                />
              ) : (
                <SubmissionRawOriginalImage
                  src={imageSource.src}
                  alt={t('voteButton.imageAlt')}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          )}
          <AlertDialogDescription>
            {t('voteButton.dialogDescription')}
            {submissionTitle && (
              <span className="mt-2 block">
                <span className="block text-xs text-muted-foreground">
                  {t('voteButton.topicLabel')}
                </span>
                <span className="block font-medium text-foreground">{submissionTitle}</span>
              </span>
            )}
            <span className="mt-2 block text-xs">{t('voteButton.cannotBeChanged')}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('voteButton.cancel')}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <PrimaryButton onClick={onVote}>{t('voteButton.confirm')}</PrimaryButton>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
