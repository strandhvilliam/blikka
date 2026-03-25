"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
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
} from "@/components/ui/alert-dialog"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Textarea } from "@/components/ui/textarea"
import { useTRPC } from "@/lib/trpc/client"
import { buildS3Url } from "@/lib/utils"
import { parseAsArrayOf, parseAsInteger, useQueryState } from "nuqs"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ImageOff,
  Loader2,
  Star,
  MessageSquare,
  UserIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getJuryCompletedPath } from "../../_lib/jury-paths"
import type { JuryInvitation, JuryParticipant, JuryRatingsResponse } from "../../_lib/jury-types"

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const SUBMISSIONS_BUCKET = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
const CONTACT_SHEETS_BUCKET = process.env.NEXT_PUBLIC_CONTACT_SHEETS_BUCKET_NAME

type JuryListParticipant = JuryParticipant & {
  contactSheetKey?: string | null
}

function getParticipantPreview(participant: JuryListParticipant) {
  if (participant.contactSheetKey) {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  if (participant.submission?.thumbnailKey) {
    return buildS3Url(THUMBNAILS_BUCKET, participant.submission.thumbnailKey)
  }

  return undefined
}

function getParticipantAssetUrl(
  participant: JuryListParticipant | null | undefined,
  invitation: JuryInvitation,
) {
  if (!participant) return undefined

  if (invitation.inviteType === "class") {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  return (
    buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.previewKey) ??
    buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.key)
  )
}

function JuryParticipantCard({
  participant,
  rating,
  onClick,
}: {
  participant: JuryListParticipant
  rating: number
  onClick: () => void
}) {
  const previewUrl = getParticipantPreview(participant)

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer items-stretch gap-0 overflow-hidden rounded-xl border border-border/60 bg-white text-left transition-all duration-200 hover:border-brand-primary/30 hover:shadow-[0_4px_24px_rgba(254,77,58,0.08)]"
      onClick={onClick}
    >
      <div className="h-auto w-24 shrink-0 overflow-hidden bg-neutral-100 sm:w-28">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Preview for ${participant.reference}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-24 w-full items-center justify-center text-brand-gray/50">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-rocgrotesk text-xl font-bold tracking-tight text-brand-black">
            {participant.reference}
          </h3>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={
                  star <= rating
                    ? "h-3.5 w-3.5 fill-brand-primary text-brand-primary"
                    : "h-3.5 w-3.5 text-border"
                }
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {participant.competitionClass?.name ? (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-black/70">
              {participant.competitionClass.name}
            </span>
          ) : null}
          {participant.deviceGroup?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-gray">
              {participant.deviceGroup.name}
            </span>
          ) : null}
          {participant.submission?.topic?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-gray">
              {participant.submission.topic.name}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function JuryParticipantList({
  participants,
  ratings,
  selectedRatings,
  toggleRatingFilter,
  onParticipantSelect,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  totalParticipants,
  error,
}: {
  participants: JuryListParticipant[]
  ratings: JuryRatingsResponse["ratings"]
  selectedRatings: number[]
  toggleRatingFilter: (rating: number) => void
  onParticipantSelect: (participantId: number, index: number) => void
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  totalParticipants?: { value: number }
  error: Error | null
}) {
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    const target = loadMoreRef.current
    if (target) {
      observer.observe(target)
    }

    return () => {
      if (target) {
        observer.unobserve(target)
      }
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (error) {
    return (
      <div className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
        <h2 className="font-rocgrotesk text-xl font-bold text-brand-black">
          Failed to load participants
        </h2>
        <p className="mt-2 text-sm text-brand-gray">
          {error.message || "An unknown error occurred"}
        </p>
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
        <h2 className="font-rocgrotesk text-xl font-bold text-brand-black">
          No participants found
        </h2>
        <p className="mt-2 text-sm text-brand-gray">
          {selectedRatings.length > 0
            ? "Try adjusting the rating filters."
            : "There are no participants to review yet."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-black">
            {participants.length} of {totalParticipants?.value ?? participants.length} participants
          </p>
        </div>
        <RatingFilterBar selectedRatings={selectedRatings} onToggle={toggleRatingFilter} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {participants.map((participant, index) => {
          const rating =
            ratings.find((item) => item.participantId === participant.id)?.rating ?? 0

          return (
            <JuryParticipantCard
              key={participant.id}
              participant={participant}
              rating={rating}
              onClick={() => onParticipantSelect(participant.id, index)}
            />
          )
        })}
      </div>

      {hasNextPage ? (
        <div ref={loadMoreRef} className="flex justify-center py-10">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-sm text-brand-gray">
              <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
              Loading more...
            </div>
          ) : (
            <div className="h-8" />
          )}
        </div>
      ) : null}
    </div>
  )
}

function RatingFilterBar({
  selectedRatings,
  onToggle,
}: {
  selectedRatings: number[]
  onToggle: (rating: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[0, 1, 2, 3, 4, 5].map((rating) => {
        const isActive = selectedRatings.includes(rating)
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onToggle(rating)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isActive
                ? "bg-brand-primary text-white"
                : "border border-border/60 bg-white text-brand-gray hover:border-brand-primary/30 hover:text-brand-black"
            }`}
          >
            {rating === 0 ? (
              "Unrated"
            ) : (
              <>
                <Star className={`h-3 w-3 ${isActive ? "fill-white" : "fill-current"}`} />
                {rating}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ProgressRing({ rated, total }: { rated: number; total: number }) {
  const pct = total > 0 ? (rated / total) * 100 : 0
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="-rotate-90" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-neutral-100" />
        <circle
          cx="24"
          cy="24"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-brand-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-brand-black">
        {Math.round(pct)}%
      </span>
    </div>
  )
}

function JuryReviewHeader({
  domain,
  token,
  invitation,
  ratedCount,
  totalParticipants,
}: {
  domain: string
  token: string
  invitation: JuryInvitation
  ratedCount: number
  totalParticipants: number
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  const completeMutation = useMutation(
    trpc.jury.updateInvitationStatusByToken.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.jury.pathKey(),
        })
        toast.success("Review completed")
        router.push(getJuryCompletedPath(domain, token))
      },
      onError: (error) => {
        toast.error(error.message || "Failed to complete review")
      },
    }),
  )

  return (
    <header className="rounded-xl border border-border/60 bg-white px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ProgressRing rated={ratedCount} total={totalParticipants} />
          <div>
            <h1 className="font-rocgrotesk text-2xl font-bold tracking-tight text-brand-black">
              Jury Review
            </h1>
            <p className="mt-0.5 text-sm text-brand-gray">{invitation.marathon.name}</p>
          </div>
          <div className="ml-2 hidden flex-wrap gap-1.5 lg:flex">
            {invitation.topic?.name ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
                {invitation.topic.name}
              </span>
            ) : null}
            {invitation.competitionClass?.name ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
                {invitation.competitionClass.name}
              </span>
            ) : null}
            {invitation.deviceGroup?.name ? (
              <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
                {invitation.deviceGroup.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-neutral-50 px-3.5 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-black">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-black">{invitation.displayName}</p>
              <p className="text-[11px] text-brand-gray">
                {ratedCount}/{totalParticipants} rated
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <PrimaryButton>
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </PrimaryButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete review</AlertDialogTitle>
                <AlertDialogDescription>
                  You will no longer be able to edit ratings after marking this review as completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={completeMutation.isPending}
                  onClick={() =>
                    completeMutation.mutate({
                      token,
                      domain,
                      status: "completed",
                    })
                  }
                >
                  {completeMutation.isPending ? "Completing..." : "Complete review"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  )
}

function JurySidebar({
  participant,
  invitation,
  rating,
  notes,
  isSaving,
  onRatingClick,
  onNotesChange,
}: {
  participant: JuryListParticipant
  invitation: JuryInvitation
  rating: number
  notes: string
  isSaving: boolean
  onRatingClick: (star: number) => void
  onNotesChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <div className="w-full space-y-3 xl:sticky xl:top-6">
      <div className="rounded-xl border border-border/60 bg-white p-5">
        <h2 className="font-rocgrotesk text-3xl font-bold tracking-tight text-brand-black">
          #{participant.reference}
        </h2>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {participant.submission?.topic?.name ? (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
              {participant.submission.topic.name}
            </span>
          ) : null}
          {participant.competitionClass?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
              {participant.competitionClass.name}
            </span>
          ) : null}
          {participant.deviceGroup?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
              {participant.deviceGroup.name}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-brand-gray">
          {invitation.inviteType === "class"
            ? "Review the generated contact sheet for this participant."
            : "Review the submission for the assigned topic."}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
            Rating
          </p>
          {isSaving ? (
            <span className="flex items-center gap-1 text-[11px] text-brand-gray">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="rounded-full p-1.5 transition-transform duration-100 hover:scale-110 active:scale-95"
              onClick={() => onRatingClick(star)}
            >
              <Star
                className={`h-6 w-6 transition-colors duration-100 ${
                  star <= rating
                    ? "fill-brand-primary text-brand-primary"
                    : "text-neutral-200 hover:text-neutral-300"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-brand-gray">
          {rating > 0 ? `${rating} of 5` : "Tap to rate"}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-brand-gray" />
          <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
            Notes
          </p>
        </div>
        <Textarea
          placeholder="Your observations on this submission..."
          className="mt-3 min-h-36 resize-none border-border/60 bg-neutral-50 text-sm placeholder:text-brand-gray/50 focus-visible:ring-brand-primary/20"
          value={notes}
          onChange={onNotesChange}
        />
      </div>
    </div>
  )
}

function JurySubmissionViewer({
  domain,
  token,
  invitation,
  participants,
  initialIndex,
  selectedRatings,
  toggleRatingFilter,
  ratings,
  totalParticipants,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  onBack,
}: {
  domain: string
  token: string
  invitation: JuryInvitation
  participants: JuryListParticipant[]
  initialIndex: number
  selectedRatings: number[]
  toggleRatingFilter: (rating: number) => void
  ratings: JuryRatingsResponse["ratings"]
  totalParticipants: number
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onBack: () => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(initialIndex),
  )
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const currentParticipant = participants[currentParticipantIndex] ?? participants[0] ?? null

  const currentParticipantId = currentParticipant?.id ?? null
  const currentAssetUrl = getParticipantAssetUrl(currentParticipant, invitation)
  const currentAssetId = String(currentParticipant?.submission?.id ?? currentParticipant?.id ?? "")

  const existingRating = useMemo(
    () => ratings.find((item) => item.participantId === currentParticipantId),
    [currentParticipantId, ratings],
  )

  const [localRating, setLocalRating] = useState(existingRating?.rating ?? 0)
  const [localNotes, setLocalNotes] = useState(existingRating?.notes ?? "")
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalRating(existingRating?.rating ?? 0)
    setLocalNotes(existingRating?.notes ?? "")
  }, [existingRating, currentParticipantId])

  useEffect(() => {
    if (participants.length - currentParticipantIndex <= 4 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [currentParticipantIndex, participants.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }
    }
  }, [])

  const invalidateJuryQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.jury.pathKey(),
    })
  }, [queryClient, trpc.jury])

  const createRatingMutation = useMutation(
    trpc.jury.createRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  )

  const updateRatingMutation = useMutation(
    trpc.jury.updateRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  )

  const deleteRatingMutation = useMutation(
    trpc.jury.deleteRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  )

  const saveRating = useCallback(
    async (nextRating: number, nextNotes: string) => {
      if (!currentParticipantId) return

      setIsSaving(true)
      try {
        if (existingRating) {
          if (nextRating === 0 && !nextNotes.trim()) {
            await deleteRatingMutation.mutateAsync({
              token,
              domain,
              participantId: currentParticipantId,
            })
          } else {
            await updateRatingMutation.mutateAsync({
              token,
              domain,
              participantId: currentParticipantId,
              rating: nextRating,
              notes: nextNotes,
            })
          }
        } else if (nextRating > 0 || nextNotes.trim()) {
          await createRatingMutation.mutateAsync({
            token,
            domain,
            participantId: currentParticipantId,
            rating: nextRating,
            notes: nextNotes,
          })
        }
      } catch (error) {
        console.error("Failed to save rating", error)
        toast.error("Failed to save review changes")
      } finally {
        setIsSaving(false)
      }
    },
    [
      createRatingMutation,
      currentParticipantId,
      deleteRatingMutation,
      domain,
      existingRating,
      token,
      updateRatingMutation,
    ],
  )

  const handleRatingClick = useCallback(
    (star: number) => {
      const nextRating = star === localRating ? 0 : star
      setLocalRating(nextRating)
      void saveRating(nextRating, localNotes)
    },
    [localNotes, localRating, saveRating],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1))
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        setCurrentParticipantIndex(Math.min(participants.length - 1, currentParticipantIndex + 1))
      }

      if (event.key === "Escape") {
        event.preventDefault()
        onBack()
      }

      if ((event.metaKey || event.ctrlKey) && ["0", "1", "2", "3", "4", "5"].includes(event.key)) {
        event.preventDefault()
        handleRatingClick(Number(event.key))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    currentParticipantIndex,
    handleRatingClick,
    onBack,
    participants.length,
    setCurrentParticipantIndex,
  ])

  const handleNotesChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextNotes = event.target.value
      setLocalNotes(nextNotes)

      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }

      notesTimeoutRef.current = setTimeout(() => {
        void saveRating(localRating, nextNotes)
      }, 800)
    },
    [localRating, saveRating],
  )

  if (!currentParticipant) {
    return (
      <div className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
        <p className="text-sm text-brand-gray">No participant selected.</p>
      </div>
    )
  }

  const visibleTotal = selectedRatings.length > 0 ? participants.length : totalParticipants

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-neutral-50 px-3 py-2 text-sm font-medium text-brand-black transition-colors hover:bg-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            List
          </button>
          <span className="font-rocgrotesk text-sm font-bold text-brand-black">
            {currentParticipantIndex + 1}
            <span className="font-sans font-normal text-brand-gray"> / {visibleTotal}</span>
          </span>
        </div>

        <RatingFilterBar selectedRatings={selectedRatings} onToggle={toggleRatingFilter} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-neutral-950">
          <div className="relative flex min-h-[60vh] items-center justify-center">
            {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
              <img
                src={currentAssetUrl}
                alt={currentParticipant.reference}
                className="max-h-[75vh] max-w-full object-contain"
                onError={() => setImageErrors((prev) => new Set(prev).add(currentAssetId))}
              />
            ) : (
              <div className="flex max-w-sm flex-col items-center justify-center px-6 text-center">
                <ImageOff className="mb-4 h-12 w-12 text-white/30" />
                <p className="font-rocgrotesk text-lg font-bold text-white/80">
                  {invitation.inviteType === "class"
                    ? "Contact sheet unavailable"
                    : "Image unavailable"}
                </p>
                <p className="mt-2 text-sm text-white/40">
                  The asset could not be loaded for this participant.
                </p>
              </div>
            )}

            <button
              type="button"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-30"
              disabled={currentParticipantIndex === 0}
              onClick={() => setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-30"
              disabled={currentParticipantIndex >= participants.length - 1}
              onClick={() =>
                setCurrentParticipantIndex(
                  Math.min(participants.length - 1, currentParticipantIndex + 1),
                )
              }
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {isFetchingNextPage ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading
              </div>
            ) : null}
          </div>
        </div>

        <JurySidebar
          participant={currentParticipant}
          invitation={invitation}
          rating={localRating}
          notes={localNotes}
          isSaving={isSaving}
          onRatingClick={handleRatingClick}
          onNotesChange={handleNotesChange}
        />
      </div>
    </div>
  )
}

export function JuryReviewClient({ domain, token }: { domain: string; token: string }) {
  const trpc = useTRPC()
  const [selectedParticipantId, setSelectedParticipantId] = useQueryState(
    "participant",
    parseAsInteger,
  )
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(0),
  )
  const [selectedRatings, setSelectedRatings] = useQueryState(
    "ratings",
    parseAsArrayOf(parseAsInteger).withDefault([]),
  )

  const { data: invitation } = useSuspenseQuery(
    trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
  )
  const { data: ratingsData } = useSuspenseQuery(
    trpc.jury.getJuryRatingsByInvitation.queryOptions({ domain, token }),
  )
  const { data: totalParticipants } = useQuery(
    trpc.jury.getJuryParticipantCount.queryOptions({
      domain,
      token,
      ratingFilter: selectedRatings.length > 0 ? selectedRatings : undefined,
    }),
  )

  const {
    data,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery(
    trpc.jury.getJurySubmissionsFromToken.infiniteQueryOptions(
      {
        domain,
        token,
        ratingFilter: selectedRatings.length > 0 ? selectedRatings : undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor,
      },
    ),
  )

  const participants = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page.participants) as JuryListParticipant[],
    [data?.pages],
  )

  const handleParticipantSelect = useCallback(
    (participantId: number, index: number) => {
      void setCurrentParticipantIndex(index)
      void setSelectedParticipantId(participantId)
    },
    [setCurrentParticipantIndex, setSelectedParticipantId],
  )

  const handleBackToList = useCallback(() => {
    void setSelectedParticipantId(null)
    void setCurrentParticipantIndex(0)
  }, [setCurrentParticipantIndex, setSelectedParticipantId])

  const toggleRatingFilter = useCallback(
    (rating: number) => {
      void setSelectedRatings((previous) =>
        previous.includes(rating)
          ? previous.filter((item) => item !== rating)
          : [...previous, rating],
      )
    },
    [setSelectedRatings],
  )

  const selectedIndex = useMemo(() => {
    if (selectedParticipantId === null) {
      return currentParticipantIndex
    }

    const index = participants.findIndex((participant) => participant.id === selectedParticipantId)
    return index >= 0 ? index : 0
  }, [currentParticipantIndex, participants, selectedParticipantId])

  return (
    <main className="min-h-dvh bg-neutral-50 bg-dot-pattern-light">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <JuryReviewHeader
          domain={domain}
          token={token}
          invitation={invitation}
          ratedCount={ratingsData.ratings.length}
          totalParticipants={totalParticipants?.value ?? participants.length}
        />

        {selectedParticipantId ? (
          <JurySubmissionViewer
            domain={domain}
            token={token}
            invitation={invitation}
            participants={participants}
            initialIndex={selectedIndex}
            selectedRatings={selectedRatings}
            toggleRatingFilter={toggleRatingFilter}
            ratings={ratingsData.ratings}
            totalParticipants={totalParticipants?.value ?? participants.length}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onBack={handleBackToList}
          />
        ) : (
          <JuryParticipantList
            participants={participants}
            ratings={ratingsData.ratings}
            selectedRatings={selectedRatings}
            toggleRatingFilter={toggleRatingFilter}
            onParticipantSelect={handleParticipantSelect}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            totalParticipants={totalParticipants}
            error={error as Error | null}
          />
        )}
      </div>
    </main>
  )
}
