import { RefreshCw, Vote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { InviteDialog } from "./invite-dialog"
import { useTRPC } from "@/lib/trpc/client"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useDomain } from "@/lib/domain-provider"

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

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

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
              <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
                Voting
              </h1>
              <Badge variant="secondary">
                <Vote className="mr-1 h-3 w-3" />
                Topic {activeTopic.orderIndex + 1}
              </Badge>
              <Badge variant="outline">By Camera</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage voting sessions and rankings for{" "}
              <span className="font-medium text-foreground">{activeTopic.name}</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefetch}
              disabled={isRefreshing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
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
        votingWindowStartsAt={summary?.votingWindow.startsAt}
        votingWindowEndsAt={summary?.votingWindow.endsAt}
      />
    </>
  )
}
