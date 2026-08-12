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

/** Wider than the brand palette — this is the one screen that gets to celebrate. */
const CONFETTI_COLORS = [
  '#22C55E',
  '#10B981',
  '#FE4D3A',
  '#F5A623',
  '#FACC15',
  '#3B82F6',
  '#A855F7',
  '#EC4899',
  '#14B8A6',
]

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

  const participantName = `${params.participantFirstName} ${params.participantLastName}`.trim()
  const chips = [
    participantName,
    participant.competitionClass?.name,
    participant.deviceGroup?.name,
  ].filter((chip): chip is string => Boolean(chip))

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
            numberOfPieces={420}
            gravity={0.2}
            colors={CONFETTI_COLORS}
            style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}
          />
        ) : null}
      </Suspense>

      {/*
       * Opening beat — the whole first screen. The oversized bottom padding is
       * what lifts the centred stack above optical centre, leaving room for the
       * timeline and the scroll cue without either falling below the fold.
       */}
      <section className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 pt-8 pb-24">
        <div
          aria-hidden="true"
          className="confirmation-glow pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-[62%] rounded-full [background:radial-gradient(circle,rgba(16,185,129,0.22)_0%,rgba(16,185,129,0.06)_42%,transparent_70%)]"
        />

        <p
          className="confirmation-fade text-center text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
          style={{ animationDelay: '120ms' }}
        >
          {marathon.name}
        </p>

        <div className="relative mt-6">
          <span
            className="confirmation-ripple absolute inset-0 rounded-full border-2 border-emerald-500"
            aria-hidden="true"
          />
          <span
            className="confirmation-ripple-late absolute inset-0 rounded-full border border-emerald-500/60"
            aria-hidden="true"
          />
          <span
            className="confirmation-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30"
            style={{ animationDelay: '180ms' }}
          >
            <Check className="h-8 w-8 text-white" strokeWidth={3} />
          </span>
        </div>

        <h1
          className="confirmation-rise mt-6 text-center font-gothic text-[30px] leading-tight font-medium tracking-tight text-balance text-foreground"
          style={{ animationDelay: '300ms' }}
        >
          {t('uploadSucceeded')}
        </h1>
        <p
          className="confirmation-rise mt-2.5 max-w-[32ch] text-center text-[14px] leading-relaxed text-balance text-muted-foreground"
          style={{ animationDelay: '360ms' }}
        >
          {t('seriesDelivered', { count: images.length })}
        </p>

        <div
          className="confirmation-rise mt-5 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: '440ms' }}
        >
          <span className="rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[13px] font-bold text-foreground tabular-nums shadow-sm">
            #{participant.reference}
          </span>
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground shadow-sm"
            >
              {chip}
            </span>
          ))}
        </div>

        {/*
         * The whole timeline, on the first screen — the page answers "and now?"
         * before asking anyone to scroll.
         *
         * A rail rather than numbered badges: the hairline carries the sequence,
         * so no row needs a numeral of its own. Sized tight — an eyebrow instead
         * of a heading, 13px rows — so it clears the fold.
         */}
        <div
          className="confirmation-rise mt-6 w-full rounded-2xl border border-border bg-card px-5 py-5 text-left shadow-sm"
          style={{ animationDelay: '520ms' }}
        >
          <p className="text-center text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t('whatsNext')}
          </p>
          <ol className="mt-4">
            {[1, 2, 3, 4].map((step) => (
              <li
                key={step}
                className="relative border-l border-border pb-3.5 pl-5 last:border-l-transparent last:pb-0"
              >
                {/* 7px dot straddling the 1px rail: -4px puts its centre on the border. */}
                <span
                  aria-hidden="true"
                  className="absolute top-[3px] -left-[4px] h-[7px] w-[7px] rounded-full border border-border bg-card"
                />
                <p className="text-[13px] leading-snug text-muted-foreground">
                  {t(`steps.${step}`)}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {images.length > 0 ? (
          <div
            className="confirmation-fade absolute inset-x-0 bottom-6 flex flex-col items-center gap-2"
            style={{ animationDelay: '900ms' }}
          >
            <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t('scrollForSeries')}
            </p>
            <span className="confirmation-nudge flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </span>
          </div>
        ) : null}
      </section>

      {/* The series, below the fold */}
      {images.length > 0 ? (
        <section className="mx-auto w-full max-w-md px-5 pt-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-gothic text-2xl font-medium tracking-tight text-foreground">
              {t('yourSeries')}
            </h2>
            <span className="font-mono text-[13px] text-muted-foreground tabular-nums">
              {images.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {images.map((image, index) => (
              <PhotoTile
                key={image.orderIndex}
                image={image}
                index={index}
                onOpen={setViewing}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Close */}
      <section
        className="mx-auto w-full max-w-md px-5 pt-8"
        style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={handleRedirect}
          className="mx-auto flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-[13px] font-semibold text-muted-foreground shadow-sm transition-transform duration-150 ease-out-strong active:scale-[0.97]"
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
  onOpen,
}: {
  image: ConfirmationImage
  index: number
  onOpen: (index: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="block w-full text-left transition-transform duration-150 ease-out-strong active:scale-[0.98]"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-muted">
        {image.imageUrl ? (
          <img
            src={image.imageUrl}
            alt={image.name}
            loading={index < 4 ? 'eager' : 'lazy'}
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
