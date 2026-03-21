import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useMemo } from "react"

interface VotingProgressProps {
  activeTopic: { id: number; name: string; orderIndex: number }
}

export function VotingProgress({
  activeTopic,
}: VotingProgressProps) {
  const trpc = useTRPC()
  const domain = useDomain()

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

  const completionRate = useMemo(() => {
    const total = summary?.sessionStats.total ?? 0
    if (total === 0) return 0
    return Math.round(((summary?.sessionStats.completed ?? 0) / total) * 100)
  }, [summary?.sessionStats.completed, summary?.sessionStats.total])

  const totalSessions = summary?.sessionStats.total ?? 0
  const completedSessions = summary?.sessionStats.completed ?? 0
  const pendingSessions = summary?.sessionStats.pending ?? 0

  return (
    <div className="rounded-xl border border-border bg-white px-4 py-4 transition-shadow duration-200 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium">Voting progress</p>
          <p className="text-xs text-muted-foreground">
            {completedSessions} of {totalSessions} sessions completed
          </p>
        </div>
        <Badge variant={pendingSessions > 0 ? "outline" : "secondary"} className="ml-auto">
          {pendingSessions > 0
            ? `${pendingSessions} pending`
            : "All sessions completed"}
        </Badge>
      </div>

      <div className="mt-4 space-y-1.5">
        <Progress value={completionRate} className="h-1.5" />
        <p className="text-xs font-medium text-muted-foreground">
          {completionRate}% completion
        </p>
      </div>
    </div>
  )
}
