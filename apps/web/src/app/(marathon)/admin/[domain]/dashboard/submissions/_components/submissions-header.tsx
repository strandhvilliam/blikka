"use client"

import { FileText, RefreshCw, Upload } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueryStates } from "nuqs"
import { submissionSearchParams } from "../_lib/search-params"
import { useEffect, useState } from "react"
import { ManualUploadDialog } from "./manual-upload-dialog"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"

function getActiveTopicDisplayText({
  activeTopicName,
  activeTopicOrderIndex,
}: {
  activeTopicName: string | null
  activeTopicOrderIndex: number | null
}) {
  if (!activeTopicName) return "No active topic"
  const orderPrefix = activeTopicOrderIndex !== null ? `#${activeTopicOrderIndex + 1} ` : ""
  return `${orderPrefix}${activeTopicName}`
}

const TAB = {
  ALL: "all",
  PREPARED: "prepared",
  INITIALIZED: "initialized",
  UPLOADED: "uploaded",
  NOT_VERIFIED: "not-verified",
  VERIFIED: "verified",
  NOT_VOTED: "not-voted",
  VOTED: "voted",
  VALIDATION_ERRORS: "validation-errors",
} as const

type Tab = (typeof TAB)[keyof typeof TAB]

const customTabTriggerClassName =
  "relative py-4 px-0 text-sm font-medium transition-colors rounded-none bg-transparent border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-brand-primary text-muted-foreground hover:text-foreground data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand-primary"

export function SubmissionsHeader() {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const activeByCameraTopic =
    marathon.mode === "by-camera"
      ? (marathon.topics.find((topic) => topic.visibility === "active") ?? null)
      : null
  const activeTopicName = activeByCameraTopic?.name ?? null
  const activeTopicOrderIndex = activeByCameraTopic?.orderIndex ?? null

  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  })
  const [isCreateUploadDialogOpen, setIsCreateUploadDialogOpen] = useState(false)

  const { tab: activeTab } = queryState

  const onTabChange = (tab: Tab) => {
    setQueryState({ tab })
  }

  const marathonTabs: { value: Tab; label: string }[] = [
    { value: TAB.ALL, label: "All Submissions" },
    { value: TAB.PREPARED, label: "Prepared" },
    { value: TAB.INITIALIZED, label: "Initialized" },
    { value: TAB.UPLOADED, label: "Uploaded" },
    { value: TAB.NOT_VERIFIED, label: "Not Verified" },
    { value: TAB.VERIFIED, label: "Verified" },
    { value: TAB.VALIDATION_ERRORS, label: "Validation Errors" },
  ]

  const byCameraTabs: { value: Tab; label: string }[] = [
    { value: TAB.ALL, label: "All Submissions" },
    { value: TAB.INITIALIZED, label: "Initialized" },
    { value: TAB.UPLOADED, label: "Uploaded" },
    { value: TAB.NOT_VOTED, label: "Not Voted" },
    { value: TAB.VOTED, label: "Voted" },
    { value: TAB.VALIDATION_ERRORS, label: "Validation Errors" },
  ]

  const tabs = marathon.mode === "by-camera" ? byCameraTabs : marathonTabs

  const effectiveTab =
    marathon.mode === "by-camera" &&
    (activeTab === TAB.PREPARED || activeTab === TAB.NOT_VERIFIED || activeTab === TAB.VERIFIED)
      ? TAB.ALL
      : marathon.mode !== "by-camera" && (activeTab === TAB.NOT_VOTED || activeTab === TAB.VOTED)
        ? TAB.ALL
        : activeTab

  useEffect(() => {
    if (
      marathon.mode === "by-camera" &&
      (activeTab === TAB.PREPARED || activeTab === TAB.NOT_VERIFIED || activeTab === TAB.VERIFIED)
    ) {
      setQueryState({ tab: TAB.ALL })
    } else if (
      marathon.mode !== "by-camera" &&
      (activeTab === TAB.NOT_VOTED || activeTab === TAB.VOTED)
    ) {
      setQueryState({ tab: TAB.ALL })
    }
  }, [marathon.mode, activeTab, setQueryState])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
              <FileText className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Participants
              </p>
              <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">
                Submissions
              </h1>
            </div>
          </div>
          {marathon.mode === "by-camera" ? (
            <p className="text-sm text-muted-foreground">
              Viewing active topic:{" "}
              <span className="font-medium text-foreground">
                {getActiveTopicDisplayText({
                  activeTopicName,
                  activeTopicOrderIndex,
                })}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              View and manage photo submissions from participants
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <PrimaryButton onClick={() => setIsCreateUploadDialogOpen(true)} className="text-xs">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Manual Upload
          </PrimaryButton>
        </div>
      </div>

      <Tabs
        value={effectiveTab}
        onValueChange={(value) => onTabChange(value as Tab)}
        className="space-y-0"
      >
        <div className="border-b border-border">
          <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={customTabTriggerClassName}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <ManualUploadDialog
        open={isCreateUploadDialogOpen}
        onOpenChange={setIsCreateUploadDialogOpen}
      />
    </div>
  )
}
