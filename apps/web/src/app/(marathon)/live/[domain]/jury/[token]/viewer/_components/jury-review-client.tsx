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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  StickyNote,
  Trophy,
  UserIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getJuryCompletedPath } from "../../_lib/jury-paths"
import type {
  JuryInvitation,
  JuryParticipant,
  JuryRatingsResponse,
} from "../../_lib/jury-types"

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
    <Card
      className="cursor-pointer overflow-hidden border-border/70 bg-white/95 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-rocgrotesk text-2xl font-bold text-foreground">
                {participant.reference}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {participant.competitionClass?.name ? (
                  <Badge variant="secondary">{participant.competitionClass.name}</Badge>
                ) : null}
                {participant.deviceGroup?.name ? (
                  <Badge variant="outline">{participant.deviceGroup.name}</Badge>
                ) : null}
                {participant.submission?.topic?.name ? (
                  <Badge variant="outline">{participant.submission.topic.name}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-amber-500">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={
                  star <= rating ? "h-4 w-4 fill-current" : "h-4 w-4 text-muted-foreground/40"
                }
              />
            ))}
          </div>
        </div>

        <div className="h-20 w-20 overflow-hidden rounded-2xl border bg-muted">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`Preview for ${participant.reference}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
      <div className="rounded-3xl border bg-white/90 px-6 py-12 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Failed to load participants
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unknown error occurred"}
        </p>
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-3xl border bg-white/90 px-6 py-12 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          No participants found
        </h2>
        <p className="text-sm text-muted-foreground">
          {selectedRatings.length > 0
            ? "Try adjusting the rating filters."
            : "There are no participants to review yet."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white/90 p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Participants loaded: {participants.length}
            </p>
            <p className="text-sm text-muted-foreground">
              Total participants: {totalParticipants?.value ?? participants.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by rating</span>
            {[0, 1, 2, 3, 4, 5].map((rating) => (
              <Button
                key={rating}
                size="sm"
                variant={selectedRatings.includes(rating) ? "default" : "outline"}
                onClick={() => toggleRatingFilter(rating)}
                className="rounded-full"
              >
                {rating === 0 ? (
                  "Unrated"
                ) : (
                  <>
                    <Star className="mr-1 h-3.5 w-3.5 fill-current" />
                    {rating}
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more participants...
              </div>
            ) : (
              <div className="h-8" />
            )}
          </div>
        ) : null}
      </div>
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
    <div className="rounded-[28px] border bg-white/90 px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-rocgrotesk text-2xl font-bold text-foreground">
                Jury review
              </h1>
              <p className="text-sm text-muted-foreground">
                {invitation.marathon.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {invitation.topic?.name ? <Badge variant="secondary">{invitation.topic.name}</Badge> : null}
            {invitation.competitionClass?.name ? (
              <Badge variant="secondary">{invitation.competitionClass.name}</Badge>
            ) : null}
            {invitation.deviceGroup?.name ? (
              <Badge variant="outline">{invitation.deviceGroup.name}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border bg-background/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <UserIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {invitation.displayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ratedCount} of {totalParticipants} participants rated
                </p>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="rounded-full">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete review
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete review</AlertDialogTitle>
                <AlertDialogDescription>
                  You will no longer be able to edit ratings after marking this
                  review as completed.
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
    </div>
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
    <div className="w-full max-w-sm space-y-4 xl:sticky xl:top-6">
      <Card className="border-border/70 bg-white/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-rocgrotesk text-3xl">
            #{participant.reference}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {participant.submission?.topic?.name ? (
              <Badge variant="secondary">{participant.submission.topic.name}</Badge>
            ) : null}
            {participant.competitionClass?.name ? (
              <Badge variant="outline">{participant.competitionClass.name}</Badge>
            ) : null}
            {participant.deviceGroup?.name ? (
              <Badge variant="outline">{participant.deviceGroup.name}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {invitation.inviteType === "class"
              ? "Review the generated contact sheet for this participant."
              : "Review the submission for the assigned topic."}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4" />
            Rating
            {isSaving ? (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Saving...
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Button
                key={star}
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => onRatingClick(star)}
              >
                <Star
                  className={
                    star <= rating
                      ? "h-5 w-5 fill-amber-500 text-amber-500"
                      : "h-5 w-5 text-muted-foreground/50"
                  }
                />
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {rating > 0 ? `Rated ${rating} out of 5 stars` : "No rating yet"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add review notes..."
            className="min-h-40 resize-none"
            value={notes}
            onChange={onNotesChange}
          />
        </CardContent>
      </Card>
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
      if (
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLInputElement
      ) {
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1))
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        setCurrentParticipantIndex(
          Math.min(participants.length - 1, currentParticipantIndex + 1),
        )
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
      <div className="rounded-3xl border bg-white/90 px-6 py-12 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">No participant selected.</p>
      </div>
    )
  }

  const visibleTotal = selectedRatings.length > 0 ? participants.length : totalParticipants

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border bg-white/90 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Button>
            <p className="text-sm text-muted-foreground">
              {currentParticipantIndex + 1} of {visibleTotal}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by rating</span>
            {[0, 1, 2, 3, 4, 5].map((rating) => (
              <Button
                key={rating}
                size="sm"
                variant={selectedRatings.includes(rating) ? "default" : "outline"}
                onClick={() => toggleRatingFilter(rating)}
                className="rounded-full"
              >
                {rating === 0 ? (
                  "Unrated"
                ) : (
                  <>
                    <Star className="mr-1 h-3.5 w-3.5 fill-current" />
                    {rating}
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border bg-white/95 p-4 shadow-sm">
          <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-[24px] bg-neutral-950">
            {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
              <img
                src={currentAssetUrl}
                alt={currentParticipant.reference}
                className="max-h-[70vh] max-w-full object-contain"
                onError={() => setImageErrors((prev) => new Set(prev).add(currentAssetId))}
              />
            ) : (
              <div className="flex max-w-md flex-col items-center justify-center px-6 text-center text-white/80">
                <ImageOff className="mb-4 h-14 w-14" />
                <p className="text-lg font-semibold">
                  {invitation.inviteType === "class"
                    ? "Contact sheet unavailable"
                    : "Image unavailable"}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  The selected asset could not be loaded for this participant.
                </p>
              </div>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="absolute left-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
              disabled={currentParticipantIndex === 0}
              onClick={() =>
                setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1))
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="absolute right-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
              disabled={currentParticipantIndex >= participants.length - 1}
              onClick={() =>
                setCurrentParticipantIndex(
                  Math.min(participants.length - 1, currentParticipantIndex + 1),
                )
              }
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            {isFetchingNextPage ? (
              <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
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

export function JuryReviewClient({
  domain,
  token,
}: {
  domain: string
  token: string
}) {
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
    <main className="min-h-dvh px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
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
