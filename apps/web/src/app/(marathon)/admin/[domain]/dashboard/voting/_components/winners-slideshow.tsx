"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { ChevronLeft, ChevronRight, Loader2, X, Trophy } from "lucide-react"
import { buildS3Url } from "@/lib/utils"
import { useImagePreloader } from "../_hooks/use-image-preloader"

interface WinnerEntry {
  rank: number
  participantFirstName: string
  participantLastName: string
  voteCount: number
  submissionThumbnailKey?: string | null
  submissionKey?: string | null
}

interface WinnersSlideshowProps {
  open: boolean
  onClose: () => void
  winners: WinnerEntry[]
  marathonName: string
  marathonLogoUrl: string | null
}

const RANK_LABELS = ["1st Place", "2nd Place", "3rd Place"] as const

function getFullImageUrl(entry: WinnerEntry) {
  const submissionsBucket = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
  const thumbnailBucket = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
  return (
    buildS3Url(submissionsBucket, entry.submissionKey) ??
    buildS3Url(thumbnailBucket, entry.submissionThumbnailKey)
  )
}

function getThumbnailUrl(entry: WinnerEntry) {
  const thumbnailBucket = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
  return buildS3Url(thumbnailBucket, entry.submissionThumbnailKey)
}

function getDisplayName(entry: WinnerEntry) {
  return `${entry.participantFirstName} ${entry.participantLastName}`.trim()
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "40%" : "-40%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-40%" : "40%",
    opacity: 0,
  }),
}

export function WinnersSlideshow({
  open,
  onClose,
  winners,
  marathonName,
  marathonLogoUrl,
}: WinnersSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  const imageUrls = useMemo(() => winners.map((w) => getFullImageUrl(w)), [winners])
  const thumbnailUrls = useMemo(() => winners.map((w) => getThumbnailUrl(w)), [winners])
  const { loaded: loadedImages, allLoaded } = useImagePreloader(imageUrls)

  const currentImageUrl = imageUrls[currentIndex]
  const isCurrentReady = !currentImageUrl || loadedImages.has(currentImageUrl)

  const goNext = useCallback(() => {
    if (currentIndex >= winners.length - 1) return
    setDirection(1)
    setCurrentIndex((prev) => prev + 1)
  }, [currentIndex, winners.length])

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return
    setDirection(-1)
    setCurrentIndex((prev) => prev - 1)
  }, [currentIndex])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        goNext()
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [open, onClose, goNext, goPrev])

  if (!open || winners.length === 0) return null

  const winner = winners[currentIndex]
  if (!winner) return null

  const imageUrl = currentImageUrl
  const rankLabel = RANK_LABELS[currentIndex] ?? `${winner.rank}th Place`

  return createPortal(
    <motion.div
      className="fixed inset-0 z-9999 flex flex-col bg-brand-black"
      role="dialog"
      aria-modal="true"
      aria-label="Winners slideshow"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Ambient background glow — uses tiny thumbnails for cheap blur */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`bg-${currentIndex}`}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {thumbnailUrls[currentIndex] && (
            <img
              src={thumbnailUrls[currentIndex]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-125 object-cover blur-[80px] opacity-30 saturate-150"
            />
          )}
          <div className="absolute inset-0 bg-brand-black/60" />
        </motion.div>
      </AnimatePresence>

      {/*
        Hidden pre-rendered images — keeps all winner images decoded in GPU memory
        so switching slides is instant. Positioned offscreen, not display:none
        (display:none would let the browser evict the decoded bitmap).
      */}
      <div className="pointer-events-none fixed -left-[9999px] -top-[9999px]" aria-hidden="true">
        {imageUrls.map((url, i) =>
          url ? <img key={i} src={url} alt="" decoding="async" /> : null,
        )}
      </div>

      {/* Loading overlay — shown until the current slide's image is ready */}
      <AnimatePresence>
        {!isCurrentReady && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-brand-black"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-white/40" />
              <p className="text-sm text-white/40">Loading image…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar — logos and marathon name */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="flex items-center gap-4">
          <img src="/blikka-logo-white.svg" alt="Blikka" className="h-6 w-auto opacity-80 md:h-7" />
          {marathonLogoUrl && (
            <>
              <div className="h-5 w-px bg-white/20" />
              <img
                src={marathonLogoUrl}
                alt={marathonName}
                className="h-7 w-auto max-w-[120px] object-contain opacity-80 md:h-8 md:max-w-[160px]"
              />
            </>
          )}
          <span className="hidden text-sm font-medium tracking-wide text-white/60 sm:block">
            {marathonName}
          </span>
        </div>

        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close slideshow"
        >
          <X className="h-5 w-5" />
        </button>
      </motion.header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-4 pb-4 md:px-8 lg:px-12">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] },
              opacity: { duration: 0.25 },
            }}
            className="flex h-full w-full min-w-0 max-w-[1600px] items-center gap-10 lg:gap-16 xl:gap-20"
            style={{ willChange: "transform, opacity" }}
          >
            {/* Photo */}
            <div className="relative flex min-w-0 flex-1 self-stretch items-center justify-center overflow-hidden rounded-2xl bg-black/40 shadow-2xl shadow-black/50 lg:rounded-3xl">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Photo by ${getDisplayName(winner)}`}
                  className="max-h-full max-w-full object-contain"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-base text-white/30">No image available</span>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="flex min-w-0 w-full max-w-sm flex-col lg:max-w-md xl:max-w-lg">
              {/* Rank badge */}
              <div className="mb-8 flex min-w-0 items-center gap-4 lg:mb-10">
                <div
                  className={`flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold lg:h-22 lg:w-22 lg:rounded-3xl lg:text-4xl ${
                    currentIndex === 0
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30"
                      : currentIndex === 1
                        ? "bg-white/15 text-white ring-1 ring-white/20"
                        : "bg-white/10 text-white/80 ring-1 ring-white/15"
                  }`}
                >
                  {winner.rank}
                </div>
                <div className="min-w-0">
                  <p className="font-special-gothic text-2xl tracking-tight text-white wrap-break-word lg:text-3xl xl:text-4xl">
                    {rankLabel}
                  </p>
                  <p className="mt-1 text-sm text-white/40 lg:text-base">
                    {winner.voteCount} vote{winner.voteCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Participant name */}
              <h2 className="max-w-full text-4xl font-bold leading-tight tracking-tight text-white wrap-break-word lg:text-5xl xl:text-6xl">
                {getDisplayName(winner)}
              </h2>

              {/* Vote count accent */}
              <div className="mt-8 flex items-baseline gap-3 lg:mt-10">
                <Trophy className="h-5 w-5 text-brand-primary lg:h-6 lg:w-6" />
                <span className="font-mono text-2xl font-bold tabular-nums text-brand-primary lg:text-3xl">
                  {winner.voteCount}
                </span>
                <span className="text-base text-white/50 lg:text-lg">
                  vote{winner.voteCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <motion.footer
        className="relative z-10 flex items-center justify-between px-6 pb-6 md:px-10 lg:px-14"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {winners.map((_, index) => {
              const url = imageUrls[index]
              const isLoaded = !url || loadedImages.has(url)
              return (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentIndex ? 1 : -1)
                    setCurrentIndex(index)
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "w-8 bg-brand-primary"
                      : isLoaded
                        ? "w-4 bg-white/20 hover:bg-white/40"
                        : "w-4 bg-white/10"
                  }`}
                  aria-label={`Go to winner ${index + 1}`}
                />
              )
            })}
          </div>
          {!allLoaded && <span className="text-[11px] text-white/30">Loading images…</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentIndex <= 0}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous winner"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex >= winners.length - 1}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next winner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </motion.footer>
    </motion.div>,
    document.body,
  )
}
