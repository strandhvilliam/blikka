"use client"

import type { Topic } from "@blikka/db"
import { Suspense, useEffect } from "react"
import {
  useSuspenseQuery,
} from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VotingHeader } from "./voting-header"
import { VotingSetup } from "./voting-setup"
import { LeaderboardTab } from "./leaderboard-tab"
import { VotersTab } from "./voters-tab"
import { LeaderboardTabSkeleton } from "./leaderboard-tab-skeleton"
import { VotersTabSkeleton } from "./voters-tab-skeleton"
import { VotingSummarySkeleton } from "./voting-summary-skeleton"
import { tabTriggerClassName } from "../_lib/utils"
import { useVotingUiState } from "../_hooks/use-voting-ui-state"

function VotingSummaryContent({
  activeTopic,
}: {
  activeTopic: Topic
}) {
  const trpc = useTRPC()
  const domain = useDomain()

  const { activeTab, setActiveTab, setLeaderboardPage, setVotersPage } = useVotingUiState()

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

  const hasSessions = (summary?.sessionStats.total ?? 0) > 0

  useEffect(() => {
    if (!hasSessions) {
      setLeaderboardPage(1)
      setVotersPage(1)
    }
  }, [hasSessions, setLeaderboardPage, setVotersPage])


  if (!hasSessions) {
    return (
      <>
        <VotingHeader activeTopic={activeTopic} />
        <VotingSetup key={activeTopic.id} activeTopic={activeTopic} />
      </>
    )
  }

  return (
    <>
      <VotingHeader activeTopic={activeTopic} />
      <VotingSetup key={activeTopic.id} activeTopic={activeTopic} />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'leaderboard' | 'voters')}
        className="space-y-0"
      >
        <div className="border-b border-border">
          <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px">
            <TabsTrigger value="leaderboard" className={tabTriggerClassName}>
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="voters" className={tabTriggerClassName}>
              Voters
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leaderboard" className="mt-6 space-y-6">
          {activeTab === "leaderboard" && (
            <Suspense fallback={<LeaderboardTabSkeleton />}>
              <LeaderboardTab
                activeTopic={activeTopic}
              />
            </Suspense>
          )}
        </TabsContent>

        <TabsContent value="voters" className="mt-6">
          {activeTab === "voters" && (
            <Suspense fallback={<VotersTabSkeleton />}>
              <VotersTab
                activeTopic={activeTopic}
              />
            </Suspense>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

export function VotingContent() {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  const activeTopic =
    marathon.topics.find((topic) => topic.visibility === "active") ?? null
  const isByCamera = marathon.mode === "by-camera"


  // useEffect(() => {
  //   setActiveTab("leaderboard")
  //   setLeaderboardPage(1)
  //   setVotersPage(1)
  // }, [activeTopic?.id])

  if (!isByCamera) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-[900] tracking-tight font-gothic">
            Voting
          </h1>
          <p className="text-muted-foreground text-sm">
            Voting administration is available only for marathons running in
            by-camera mode.
          </p>
        </div>

        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Voting unavailable</AlertTitle>
          <AlertDescription>
            Current marathon mode is <strong>{marathon.mode}</strong>. Switch to
            by-camera mode to enable voting sessions and leaderboard management.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!activeTopic) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight font-gothic">
            Voting
          </h1>
          <p className="text-muted-foreground text-sm">
            No active topic is currently available.
          </p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing active topic</AlertTitle>
          <AlertDescription>
            Activate a by-camera topic in Topics before starting voting.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-8 pb-8">
          <VotingSummarySkeleton />
        </div>
      }
    >
      <div className="space-y-8 pb-8">
        <VotingSummaryContent
          activeTopic={activeTopic}
        />
      </div>
    </Suspense>
  )
}
