import { useEffect, useMemo, useState } from "react"
import { addHours } from "date-fns"
import {
  Loader2,
  Vote,
  AlertTriangle,
  CheckCircle2,
  Image,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  toDateTimeLocalValue,
  toIsoFromLocal,
  hasValidDateRange,
  formatDateTime,
} from "../_lib/utils"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Button } from "@/components/ui/button"
import { useAutoSave } from "@/hooks/use-auto-save"

interface VotingSetupProps {
  activeTopic: { id: number; name: string; orderIndex: number }
  hasSessions: boolean
}

export function VotingSetup({
  activeTopic,
  hasSessions,
}: VotingSetupProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()

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

  const startVotingMutation = useMutation(
    trpc.voting.startVotingSessions.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting sessions started successfully")
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
        ])
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start voting sessions")
      },
    }),
  )

  const [startsAtInput, setStartsAtInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  )
  const [endsAtInput, setEndsAtInput] = useState(() =>
    toDateTimeLocalValue(addHours(new Date(), 24)),
  )

  useEffect(() => {
    const startsAt = summary?.votingWindow?.startsAt
    const endsAt = summary?.votingWindow?.endsAt

    if (startsAt && endsAt) {
      setStartsAtInput(toDateTimeLocalValue(new Date(startsAt)))
      setEndsAtInput(toDateTimeLocalValue(new Date(endsAt)))
      return
    }

    setStartsAtInput(toDateTimeLocalValue(new Date()))
    setEndsAtInput(toDateTimeLocalValue(addHours(new Date(), 24)))
  }, [summary?.votingWindow?.startsAt, summary?.votingWindow?.endsAt])

  const submissionCount = summary?.submissionStats.submissionCount ?? 0
  const participantWithSubmissionCount =
    summary?.submissionStats.participantWithSubmissionCount ?? 0

  const hasWindow =
    !!summary?.votingWindow?.startsAt && !!summary?.votingWindow?.endsAt

  const launchStartsAtIso = toIsoFromLocal(startsAtInput)
  const launchEndsAtIso = toIsoFromLocal(endsAtInput)
  const canSaveWindow = hasValidDateRange(launchStartsAtIso, launchEndsAtIso)

  const serverStartsAt = summary?.votingWindow?.startsAt
  const serverEndsAt = summary?.votingWindow?.endsAt
  const datesDifferFromServer =
    canSaveWindow &&
    launchStartsAtIso &&
    launchEndsAtIso &&
    (!serverStartsAt ||
      !serverEndsAt ||
      new Date(launchStartsAtIso).getTime() !== new Date(serverStartsAt).getTime() ||
      new Date(launchEndsAtIso).getTime() !== new Date(serverEndsAt).getTime())

  useAutoSave({
    value: { startsAt: launchStartsAtIso, endsAt: launchEndsAtIso },
    onSave: ({ startsAt, endsAt }) => {
      if (!startsAt || !endsAt || !hasValidDateRange(startsAt, endsAt)) return
      setWindowMutation.mutate({
        domain,
        topicId: activeTopic.id,
        startsAt,
        endsAt,
      })
    },
    delay: 500,
    enabled: !!datesDifferFromServer,
  })

  const windowState = useMemo(() => {
    if (!summary?.votingWindow?.startsAt || !summary?.votingWindow?.endsAt) {
      return {
        label: "Not configured",
        toneClass: "border-slate-200 bg-slate-100 text-slate-700",
        isActive: false,
      }
    }

    const now = new Date().getTime()
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

  const handleStartVoting = () => {
    if (submissionCount === 0) {
      toast.error("No submissions are available for this topic")
      return
    }

    if (!hasWindow) {
      toast.error("Configure a voting window before starting sessions")
      return
    }

    startVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
    })
  }

  const isStarting = startVotingMutation.isPending
  const canStartVoting = !hasSessions && submissionCount > 0 && hasWindow


  return (
    <Card className="border-slate-200 shadow-sm py-4 l">
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="font-gothic text-xl">
          Before you start
        </CardTitle>
        <CardDescription>
          Configure the voting window, confirm the topic is ready, then
          launch voting sessions once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Voting window</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voting-start-at">Start</Label>
              <Input
                id="voting-start-at"
                type="datetime-local"
                value={startsAtInput}
                onChange={(event) => setStartsAtInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voting-end-at">End</Label>
              <Input
                id="voting-end-at"
                type="datetime-local"
                value={endsAtInput}
                onChange={(event) => setEndsAtInput(event.target.value)}
              />
            </div>
          </div>

          {!canSaveWindow ? (
            <p className="text-xs text-muted-foreground">
              End must be later than start.
            </p>
          ) : null}

          {datesDifferFromServer && setWindowMutation.isPending ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Image className="h-4 w-4" />
              <p className="text-sm">Submissions in topic</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {submissionCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              All uploads under <strong>{activeTopic.name}</strong>.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <p className="text-sm">Eligible participants</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {participantWithSubmissionCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              One session is created per participant.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-sm text-muted-foreground">Launch checklist</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm text-slate-700">
                Topic has submissions
              </span>
              {submissionCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing
                </span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-sm text-slate-700">
                Voting window is configured
              </span>
              {hasWindow ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={handleStartVoting}
          disabled={isStarting || !canStartVoting}
          className="h-10 w-full"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting voting...
            </>
          ) : (
            <>
              <Vote className="mr-2 h-4 w-4" />
              Start Voting Sessions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
