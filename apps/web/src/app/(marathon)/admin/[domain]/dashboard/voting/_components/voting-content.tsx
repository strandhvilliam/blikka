"use client"

import type { Topic } from "@blikka/db"
import { Suspense, useEffect } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { AlertTriangle, Vote } from "lucide-react"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
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
import { useVotingRealtime } from "../_hooks/use-voting-realtime"

function VotingSummaryContent({
  activeTopic,
}: {
  activeTopic: Topic
}) {
  const trpc = useTRPC()
  const domain = useDomain()

  const {
    activeTab,
    setActiveTab,
    setLeaderboardPage,
    setVotersPage,
    leaderboardPage,
    votersPage,
  } = useVotingUiState()

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

  useVotingRealtime({
    domain,
    topicId: activeTopic.id,
    leaderboardPage,
    votersPage,
  })

  const hasSessions = (summary?.sessionStats.total ?? 0) > 0

  useEffect(() => {
    if (!hasSessions) {
      setLeaderboardPage(1)
      setVotersPage(1)
    }
  }, [hasSessions, setLeaderboardPage, setVotersPage])

  return (
    <>
      <VotingHeader activeTopic={activeTopic} />
      <VotingSetup key={activeTopic.id} activeTopic={activeTopic} />

      <div className="relative mt-8">
        {!hasSessions && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-4 py-2 text-[13px] font-medium text-muted-foreground shadow-sm">
              Available after voting has started
            </span>
          </div>
        )}
        <div className={hasSessions ? "" : "opacity-50 pointer-events-none blur-[2px]"}>
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
            {activeTab === "leaderboard" && hasSessions && (
              <Suspense fallback={<LeaderboardTabSkeleton />}>
                <LeaderboardTab
                  activeTopic={activeTopic}
                />
              </Suspense>
            )}
            {!hasSessions && <LeaderboardTabSkeleton />}
          </TabsContent>

          <TabsContent value="voters" className="mt-6">
            {activeTab === "voters" && hasSessions && (
              <Suspense fallback={<VotersTabSkeleton />}>
                <VotersTab
                  activeTopic={activeTopic}
                />
              </Suspense>
            )}
            {!hasSessions && <VotersTabSkeleton />}
          </TabsContent>
        </Tabs>
        </div>
      </div>
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

  if (!isByCamera) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
            <Vote className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Sessions
            </p>
            <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Voting</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Voting administration is available only for marathons running in by-camera mode.
        </p>

        <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-[13px] font-medium text-amber-900">Voting unavailable</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-amber-800/70">
              Current marathon mode is <strong>{marathon.mode}</strong>. Switch to
              by-camera mode to enable voting sessions and leaderboard management.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!activeTopic) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
            <Vote className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              By Camera
            </p>
            <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Voting</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          No active topic is currently available.
        </p>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-[13px] font-medium text-foreground">Missing active topic</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Activate a by-camera topic in Topics before starting voting.
            </p>
          </div>
        </div>
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
