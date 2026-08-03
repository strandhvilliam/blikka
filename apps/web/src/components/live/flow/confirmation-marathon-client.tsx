'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Recycle } from 'lucide-react'

import { buildS3Url, formatDomainPathname } from '@/lib/utils'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'

import { ConfirmationPhotoViewer } from './confirmation-photo-viewer'

const Confetti = dynamic(() => import('react-confetti').then((mod) => mod.default), {
  ssr: false,
})

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const SUBMISSIONS_BUCKET = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

export interface ConfirmationImage {
  imageUrl: string | undefined
  name: string
  orderIndex: number
}

interface ConfirmationMarathonClientProps {
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
  }
}

export function ConfirmationMarathonClient({ params }: ConfirmationMarathonClientProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const t = useTranslations('ConfirmationPage')
  const reduceMotion = useReducedMotion()
  const [viewing, setViewing] = useState<number | null>(null)

  const handleRedirect = () => {
    window.location.replace(formatDomainPathname('/live/marathon', domain, 'live'))
  }

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      reference: params.participantRef ?? '',
      domain,
    }),
  )
  // Already in the cache — the page prefetches it and the parent reads it too.
  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  const submissions = participant?.publicSubmissions ? [...participant.publicSubmissions] : []

  const images: ConfirmationImage[] = submissions
    .sort((a, b) => (a.topic?.orderIndex ?? 0) - (b.topic?.orderIndex ?? 0))
    .map((submission, index) => ({
      imageUrl:
        buildS3Url(THUMBNAILS_BUCKET, submission.thumbnailKey) ??
        buildS3Url(SUBMISSIONS_BUCKET, submission.key),
      name: submission.topic?.name ?? t('photoPlaceholder', { id: index + 1 }),
      orderIndex: submission.topic?.orderIndex ?? index,
    }))

  const tags = [participant.deviceGroup?.name, participant.competitionClass?.name].filter(Boolean)

  return (
    <div className="w-full overflow-x-clip">
      {/*
       * `next/dynamic` with `ssr: false` bails its whole subtree out to
       * client-side rendering. Without this boundary that subtree is the entire
       * page, so nothing paints until the bundle lands.
       */}
      <Suspense fallback={null}>
        {!reduceMotion && images.length > 0 ? (
          <Confetti
            recycle={false}
            numberOfPieces={220}
            gravity={0.18}
            colors={['#FE4D3A', '#FE3923', '#1C1C1C', '#E8E4DF', '#F5A623']}
            style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}
          />
        ) : null}
      </Suspense>

      {/* Opening beat — the whole first screen */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-16 pb-16">
        {/* The series itself, as wallpaper */}
        {images.length > 0 ? (
          <div
            aria-hidden="true"
            className="confirmation-wallpaper pointer-events-none absolute inset-0 -z-10 grid auto-rows-min grid-cols-4 content-start gap-1 overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_24%,transparent_68%)]"
          >
            {images.map((image) =>
              image.imageUrl ? (
                <div key={image.orderIndex} className="aspect-square overflow-hidden">
                  <img
                    src={image.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover blur-[1px]"
                  />
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        <p
          className="confirmation-fade text-center text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
          style={{ animationDelay: '160ms' }}
        >
          {marathon.name}
        </p>

        <div className="relative mt-8">
          <span
            className="confirmation-ripple absolute inset-0 rounded-full border border-brand-primary"
            aria-hidden="true"
          />
          <span
            className="confirmation-pop relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary"
            style={{ animationDelay: '240ms' }}
          >
            <Check className="h-6 w-6 text-white" strokeWidth={3} />
          </span>
        </div>

        <p
          className="confirmation-settle mt-7 font-special-gothic text-[86px] leading-[0.86] text-brand-primary tabular-nums"
          style={{ animationDelay: '340ms' }}
        >
          {images.length}
        </p>
        <p
          className="confirmation-rise mt-2 text-[13px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
          style={{ animationDelay: '400ms' }}
        >
          {t('photosDelivered')}
        </p>
        <h1
          className="confirmation-rise mt-5 text-center font-gothic text-[26px] leading-tight font-medium tracking-tight text-balance text-foreground"
          style={{ animationDelay: '460ms' }}
        >
          {t('seriesComplete')}
        </h1>

        <p
          className="confirmation-rise mt-6 flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] text-muted-foreground shadow-sm"
          style={{ animationDelay: '520ms' }}
        >
          <span className="font-mono text-[15px] font-bold text-foreground tabular-nums">
            #{participant.reference}
          </span>
          <span className="h-3 w-px bg-border" aria-hidden="true" />
          {params.participantFirstName} {params.participantLastName}
        </p>

        {images.length > 0 ? (
          <div
            className="confirmation-fade absolute inset-x-0 bottom-8 flex flex-col items-center gap-1.5"
            style={{ animationDelay: '900ms' }}
          >
            <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t('yourSeries')}
            </p>
            <ChevronDown className="confirmation-nudge h-4 w-4 text-muted-foreground" />
          </div>
        ) : null}
      </section>

      {/* The series, as a spread */}
      {images.length > 0 ? (
        <section className="mx-auto w-full max-w-[520px] px-4 pb-4">
          {Array.from({ length: Math.ceil(images.length / 3) }, (_, group) => {
            const [lead, ...rest] = images.slice(group * 3, group * 3 + 3)
            if (!lead) return null
            return (
              <div key={group} className="mb-2">
                <PhotoTile
                  image={lead}
                  index={group * 3}
                  ratio="aspect-[3/2]"
                  onOpen={setViewing}
                />
                {rest.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {rest.map((image, offset) => (
                      <PhotoTile
                        key={image.orderIndex}
                        image={image}
                        index={group * 3 + offset + 1}
                        ratio="aspect-square"
                        onOpen={setViewing}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </section>
      ) : null}

      {/* What happens now */}
      <section className="mx-auto w-full max-w-[520px] px-6 pt-10 pb-4">
        <h2 className="font-gothic text-2xl font-medium tracking-tight text-foreground">
          {t('whatsNext')}
        </h2>
        <ol className="mt-5">
          {[1, 2, 3, 4].map((step) => (
            <li key={step} className="flex gap-4 border-t border-border py-4 last:border-b">
              <span className="mt-0.5 font-mono text-[13px] font-bold text-brand-primary tabular-nums">
                {String(step).padStart(2, '0')}
              </span>
              <p className="min-w-0 text-[15px] leading-snug text-foreground">
                {step === 3
                  ? t('steps.3', { juryDate: '31/8', resultsDate: '1/9' })
                  : step === 4
                    ? t('steps.4', { prizeDate: '20/8' })
                    : t(`steps.${step}`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Close */}
      <section
        className="mx-auto w-full max-w-[520px] px-6 pt-6"
        style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}
      >
        <div className="rounded-2xl bg-muted/50 px-5 py-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {t('registeredAs')}
          </p>
          <p className="mt-1.5 text-[15px] font-semibold text-foreground">
            {params.participantFirstName} {params.participantLastName}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {['#' + participant.reference, ...tags].join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRedirect}
          className="mx-auto mt-6 flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-muted-foreground transition-transform duration-150 ease-out-strong active:scale-[0.97]"
        >
          <Recycle className="h-4 w-4" />
          {t('startAgain')}
        </button>
      </section>

      {viewing !== null ? (
        <ConfirmationPhotoViewer
          images={images}
          initialIndex={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  )
}

function PhotoTile({
  image,
  index,
  ratio,
  onOpen,
}: {
  image: ConfirmationImage
  index: number
  ratio: string
  onOpen: (index: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="block w-full text-left transition-transform duration-150 ease-out-strong active:scale-[0.99]"
    >
      <div className={`${ratio} overflow-hidden rounded-xl bg-muted`}>
        {image.imageUrl ? (
          <img
            src={image.imageUrl}
            alt={image.name}
            loading={index < 3 ? 'eager' : 'lazy'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs text-muted-foreground">—</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 flex items-baseline gap-1.5 px-0.5 text-[12px] text-foreground">
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="truncate font-medium">{image.name}</span>
      </p>
    </button>
  )
}
