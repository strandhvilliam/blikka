import { addHours } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  UserPlus,
  Vote,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InviteDialog } from "./invite-dialog"
import { useTRPC } from "@/lib/trpc/client"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useDomain } from "@/lib/domain-provider"
import {
  formatDateTime,
  hasValidDateRange,
  toDateTimeLocalValue,
  toIsoFromLocal,
} from "../_lib/utils"
import { toast } from "sonner"

interface VotingHeaderProps {
  activeTopic: { id: number; name: string; orderIndex: number }
  hasSessions: boolean
  isOverviewLoading: boolean
}

export function VotingHeader({
  activeTopic,
  hasSessions,
  isOverviewLoading,
}: VotingHeaderProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isWindowDialogOpen, setIsWindowDialogOpen] = useState(false)
  const [startsAtInput, setStartsAtInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  )
  const [endsAtInput, setEndsAtInput] = useState(() =>
    toDateTimeLocalValue(addHours(new Date(), 24)),
  )

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

  const setWindowMutation = useMutation(
    trpc.voting.setTopicVotingWindow.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting window updated")
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
          }),
        ])
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update voting window")
      },
    }),
  )

  const closeWindowMutation = useMutation(
    trpc.voting.closeTopicVotingWindow.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting window closed")
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
          }),
        ])
      },
      onError: (error) => {
        toast.error(error.message || "Failed to close voting window")
      },
    }),
  )

  useEffect(() => {
    if (!isWindowDialogOpen) {
      return
    }

    const startsAt = summary?.votingWindow?.startsAt
    const endsAt = summary?.votingWindow?.endsAt

    if (startsAt && endsAt) {
      setStartsAtInput(toDateTimeLocalValue(new Date(startsAt)))
      setEndsAtInput(toDateTimeLocalValue(new Date(endsAt)))
      return
    }

    setStartsAtInput(toDateTimeLocalValue(new Date()))
    setEndsAtInput(toDateTimeLocalValue(addHours(new Date(), 24)))
  }, [
    isWindowDialogOpen,
    summary?.votingWindow?.startsAt,
    summary?.votingWindow?.endsAt,
  ])

  const hasWindow =
    !!summary?.votingWindow?.startsAt && !!summary?.votingWindow?.endsAt

  const windowState = useMemo(() => {
    if (!summary?.votingWindow?.startsAt || !summary?.votingWindow?.endsAt) {
      return {
        label: "Not configured",
        toneClass: "border-slate-200 bg-slate-100 text-slate-700",
        isActive: false,
      }
    }

    const now = Date.now()
    const startsAt = new Date(summary.votingWindow.startsAt).getTime()
    const endsAt = new Date(summary.votingWindow.endsAt).getTime()

    if (now < startsAt) {
      return {
        label: "Scheduled",
        toneClass: "border-blue-200 bg-blue-50 text-blue-700",
        isActive: false,
      }
    }

    if (now > endsAt) {
      return {
        label: "Closed",
        toneClass: "border-amber-200 bg-amber-50 text-amber-700",
        isActive: false,
      }
    }

    return {
      label: "Active",
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      isActive: true,
    }
  }, [summary?.votingWindow?.startsAt, summary?.votingWindow?.endsAt])

  const canSaveWindow = hasValidDateRange(
    toIsoFromLocal(startsAtInput),
    toIsoFromLocal(endsAtInput),
  )

  const handleSaveWindow = () => {
    const startsAtIso = toIsoFromLocal(startsAtInput)
    const endsAtIso = toIsoFromLocal(endsAtInput)

    if (!startsAtIso || !endsAtIso) {
      toast.error("Please provide valid start and end timestamps")
      return
    }

    if (!hasValidDateRange(startsAtIso, endsAtIso)) {
      toast.error("End timestamp must be later than start timestamp")
      return
    }

    setWindowMutation.mutate({
      domain,
      topicId: activeTopic.id,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    })
  }

  const handleRefetch = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
        }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-gothic text-3xl font-bold tracking-tight">
                Voting
              </h1>
              <Badge variant="secondary">
                <Vote className="mr-1 h-3 w-3" />
                Topic {activeTopic.orderIndex + 1}
              </Badge>
              <Badge variant="outline">By Camera</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage voting sessions and rankings for{" "}
              <span className="font-medium text-foreground">
                {activeTopic.name}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefetch}
              disabled={isRefreshing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {hasSessions ? (
              <Button
                variant="outline"
                onClick={() => setIsWindowDialogOpen(true)}
              >
                <Clock3 className="mr-2 h-4 w-4" />
                Edit Voting Window
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(true)}
              disabled={!hasSessions || isOverviewLoading}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Manual Voter
            </Button>
          </div>
        </div>
      </section>

      <InviteDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        activeTopic={activeTopic}
      />

      <Dialog open={isWindowDialogOpen} onOpenChange={setIsWindowDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Edit voting window</DialogTitle>
            <DialogDescription>
              Changes apply immediately to all voting links in this topic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-600">
                  Current window
                </p>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${windowState.toneClass}`}
                >
                  {windowState.label}
                </span>
              </div>
              {hasWindow ? (
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatDateTime(summary.votingWindow.startsAt)} to{" "}
                  {formatDateTime(summary.votingWindow.endsAt)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-700">
                  No voting window configured yet.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="window-start">Start timestamp</Label>
                <Input
                  id="window-start"
                  type="datetime-local"
                  value={startsAtInput}
                  onChange={(event) => setStartsAtInput(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window-end">End timestamp</Label>
                <Input
                  id="window-end"
                  type="datetime-local"
                  value={endsAtInput}
                  onChange={(event) => setEndsAtInput(event.target.value)}
                />
              </div>
            </div>

            {!canSaveWindow ? (
              <p className="text-xs text-slate-600">
                End timestamp must be later than start timestamp.
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                closeWindowMutation.mutate({
                  domain,
                  topicId: activeTopic.id,
                })
              }}
              disabled={
                closeWindowMutation.isPending || !hasWindow || !windowState.isActive
              }
            >
              {closeWindowMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Close Voting Now
                </>
              )}
            </Button>
            <Button
              onClick={handleSaveWindow}
              disabled={setWindowMutation.isPending || !canSaveWindow}
            >
              {setWindowMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Save Window
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
