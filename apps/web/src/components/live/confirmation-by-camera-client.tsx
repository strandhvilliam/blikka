'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, Check, MoreVertical, Recycle, Vote } from 'lucide-react'
import { Icon } from '@iconify/react'

import { findActiveTopic } from '@/lib/by-camera/by-camera-active-topic'
import { getByCameraSubmissionWindowState } from '@/lib/by-camera/by-camera-submission-window-state'
import { buildS3Url, formatDomainPathname } from '@/lib/utils'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import type { RouterOutputs } from '@blikka/api/trpc'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/primary-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { ConfirmationImage } from './confirmation-marathon-client'

const Confetti = dynamic(() => import('react-confetti').then((mod) => mod.default), {
  ssr: false,
})

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const SUBMISSIONS_BUCKET = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

interface ConfirmationByCameraClientProps {
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
  }
  topics: RouterOutputs['uploadFlow']['getPublicMarathon']['topics']
}

type ParticipantCardProps = {
  participantFirstName: string
  participantLastName: string
  participantReference: string
  deviceGroup?: {
    name: string
    icon: string | null
  } | null
  image?: ConfirmationImage | null
  onImageClick?: () => void
}

function ParticipantCard({
  participantFirstName,
  participantLastName,
  participantReference,
  deviceGroup,
  image,
  onImageClick,
}: ParticipantCardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-white overflow-hidden ${
        onImageClick ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''
      }`}
      onClick={onImageClick}
    >
      <div className="w-full max-h-[200px] min-h-[120px] flex items-center justify-center overflow-hidden bg-stone-50">
        {image?.imageUrl ? (
          <img
            src={image.imageUrl}
            alt={image.name}
            className="block max-w-full max-h-[200px] object-contain"
          />
        ) : (
          <div className="w-full min-h-[120px] flex items-center justify-center">
            <Icon icon="solar:camera-minimalistic-broken" className="w-12 h-12 text-stone-300" />
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate text-sm">
              {participantFirstName} {participantLastName}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">#{participantReference}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {deviceGroup?.name && (
              <span className="text-[11px] text-stone-700 flex items-center gap-1 bg-stone-100 border border-stone-200/60 px-2 py-0.5 rounded-md font-medium">
                <Icon
                  icon={
                    deviceGroup.icon === 'smartphone'
                      ? 'solar:smartphone-broken'
                      : 'solar:camera-minimalistic-broken'
                  }
                  className="w-3 h-3"
                />
                {deviceGroup.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmationByCameraHeaderMenu({ onStartAgain }: { onStartAgain: () => void }) {
  const t = useTranslations('ConfirmationPage')

  return (
    <div className="md:hidden absolute top-3 right-3 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-8 w-8 text-muted-foreground"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">{t('menu')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <button onClick={onStartAgain}>
              <Recycle className="w-4 h-4" />
              {t('startAgain')}
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ConfirmationImagePreview({
  previewImage,
  onClose,
}: {
  previewImage: { imageUrl: string; name: string }
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={previewImage.imageUrl}
          alt={previewImage.name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
        <div className="absolute -bottom-10 left-0 right-0 text-center">
          <p className="text-white/70 text-sm">{previewImage.name}</p>
        </div>
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
        >
          <Icon icon="solar:close-circle-broken" className="w-5 h-5 text-white" />
        </button>
      </motion.div>
    </motion.div>
  )
}

function ConfirmationByCameraSuccessView({
  participantCardProps,
  image,
}: {
  participantCardProps: Omit<ParticipantCardProps, 'image' | 'onImageClick'>
  image: ConfirmationImage
}) {
  const t = useTranslations('ConfirmationPage')
  const [previewImage, setPreviewImage] = useState<{ imageUrl: string; name: string } | null>(null)

  const openPreview = () => {
    if (image.imageUrl) {
      setPreviewImage({ imageUrl: image.imageUrl, name: image.name })
    }
  }

  return (
    <>
      <Confetti recycle={false} numberOfPieces={400} />
      <AnimatePresence mode="sync">
        <motion.div
          key="confirmation"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="flex flex-col items-center pt-10"
        >
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 180, damping: 14 }}
              className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center"
            >
              <Check className="h-10 w-10 text-white" strokeWidth={3} />
            </motion.div>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [1, 1.035, 1],
                opacity: [1, 0.72, 1],
              }}
              transition={{
                delay: 0.4,
                duration: 3.8,
                ease: 'easeInOut',
                repeat: Number.POSITIVE_INFINITY,
              }}
              className="absolute inset-0 rounded-full border-2 border-emerald-600/30 scale-[1.35]"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [1, 1.025, 1],
                opacity: [1, 0.7, 1],
              }}
              transition={{
                delay: 0.75,
                duration: 4.6,
                ease: 'easeInOut',
                repeat: Number.POSITIVE_INFINITY,
              }}
              className="absolute inset-0 rounded-full border border-emerald-600/15 scale-[1.7]"
            />
            <motion.div
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{
                scale: [1.05, 1.92],
                opacity: [0, 0.24, 0],
              }}
              transition={{
                delay: 0.9,
                duration: 2.4,
                ease: 'easeOut',
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.2,
              }}
              className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
            />
            <motion.div
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{
                scale: [1.05, 1.92],
                opacity: [0, 0.18, 0],
              }}
              transition={{
                delay: 2.1,
                duration: 2.4,
                ease: 'easeOut',
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.2,
              }}
              className="absolute inset-0 rounded-full border border-emerald-500/20"
            />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-gothic font-semibold text-foreground mt-10 tracking-tight"
          >
            {t('congratulations')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-sm mt-1"
          >
            {t('photoUploaded')}
          </motion.p>
        </motion.div>

        <motion.div
          key="photo-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <ParticipantCard {...participantCardProps} image={image} onImageClick={openPreview} />
        </motion.div>

        <motion.div
          key="voting-info"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-5"
        >
          <div className="rounded-xl border border-border bg-stone-50/60 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 bg-white border border-border rounded-lg flex items-center justify-center shadow-sm">
                <Vote className="h-4 w-4 text-stone-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{t('votingTitle')}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                  {t('votingMessage')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {previewImage ? (
        <ConfirmationImagePreview previewImage={previewImage} onClose={() => setPreviewImage(null)} />
      ) : null}
    </>
  )
}

function ConfirmationByCameraMissingSubmissionView({
  participantCardProps,
  topicLabel,
  isTopicClosed,
  onGoToLive,
}: {
  participantCardProps: Omit<ParticipantCardProps, 'image' | 'onImageClick'>
  topicLabel: string
  isTopicClosed: boolean
  onGoToLive: () => void
}) {
  const t = useTranslations('ConfirmationPage')

  return (
    <AnimatePresence mode="sync">
      <motion.div
        key="missing-submission"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center pt-10"
      >
        <div className="w-20 h-20 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center">
          <Icon icon="solar:camera-minimalistic-broken" className="w-10 h-10 text-stone-400" />
        </div>

        <h1 className="text-2xl font-gothic font-semibold text-foreground mt-10 tracking-tight text-center">
          {isTopicClosed ? t('byCameraMissedTopicTitle') : t('byCameraNotUploadedTitle')}
        </h1>
        <p className="text-muted-foreground text-sm mt-2 text-center leading-relaxed max-w-sm">
          {isTopicClosed
            ? t('byCameraMissedTopicMessage', { topic: topicLabel })
            : t('byCameraNotUploadedMessage', { topic: topicLabel })}
        </p>
      </motion.div>

      <motion.div
        key="missing-submission-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mt-6"
      >
        <ParticipantCard {...participantCardProps} />
      </motion.div>

      {!isTopicClosed ? (
        <motion.div
          key="missing-submission-action"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-6"
        >
          <PrimaryButton className="w-full rounded-full py-3 text-base" onClick={onGoToLive}>
            {t('byCameraGoToLive')}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function ConfirmationByCameraClient({ params, topics }: ConfirmationByCameraClientProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const t = useTranslations('ConfirmationPage')

  const handleRedirect = () => {
    window.location.replace(formatDomainPathname('/live/by-camera', domain, 'live'))
  }

  const handleGoToLive = () => {
    window.location.assign(formatDomainPathname('/live', domain, 'live'))
  }

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      reference: params.participantRef ?? '',
      domain,
    }),
  )

  const activeTopic = findActiveTopic(topics)

  const submission = activeTopic
    ? participant.publicSubmissions.find(
        (entry) => entry.topic?.orderIndex === activeTopic.orderIndex,
      )
    : null

  const hasActiveTopicSubmission = Boolean(submission)
  const submissionWindowState = getByCameraSubmissionWindowState(activeTopic)
  const topicLabel = activeTopic?.name ?? t('byCameraCurrentTopic')
  const isTopicClosed = submissionWindowState === 'closed'

  const image: ConfirmationImage | null = submission
    ? {
        imageUrl:
          buildS3Url(THUMBNAILS_BUCKET, submission.thumbnailKey) ??
          buildS3Url(SUBMISSIONS_BUCKET, submission.key),
        name: activeTopic?.name ?? submission.topic?.name ?? t('photoPlaceholder') ?? '',
        orderIndex: activeTopic?.orderIndex ?? submission.topic?.orderIndex ?? 0,
      }
    : null

  const participantCardProps = {
    participantFirstName: params.participantFirstName,
    participantLastName: params.participantLastName,
    participantReference: participant.reference,
    deviceGroup: participant.deviceGroup,
  }

  return (
    <div className="min-h-dvh px-5 py-8 max-w-[540px] mx-auto flex flex-col">
      <ConfirmationByCameraHeaderMenu onStartAgain={handleRedirect} />

      {hasActiveTopicSubmission && image ? (
        <ConfirmationByCameraSuccessView participantCardProps={participantCardProps} image={image} />
      ) : (
        <ConfirmationByCameraMissingSubmissionView
          participantCardProps={participantCardProps}
          topicLabel={topicLabel}
          isTopicClosed={isTopicClosed}
          onGoToLive={handleGoToLive}
        />
      )}
    </div>
  )
}
