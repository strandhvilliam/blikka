"use client"

import { ChevronDown, Images, RefreshCw, Upload } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useQueryStates } from "nuqs"
import { submissionSearchParams } from "../_lib/search-params"
import { useEffect, useState } from "react"
import { ManualUploadDialog } from "./manual-upload-dialog"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false)

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

  const activeTabLabel =
    tabs.find((t) => t.value === effectiveTab)?.label ?? "All Submissions"

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
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
              <Images className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
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
        <div className="flex w-full items-center gap-2 md:w-auto md:shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs min-h-9 flex-1 items-center justify-center gap-1.5 md:flex-initial"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <PrimaryButton
            onClick={() => setIsCreateUploadDialogOpen(true)}
            className="text-xs min-h-9 flex-1 items-center justify-center gap-1.5 md:flex-initial"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="md:hidden">Manual</span>
            <span className="hidden md:inline">Manual Upload</span>
          </PrimaryButton>
        </div>
      </div>

      <Tabs
        value={effectiveTab}
        onValueChange={(value) => onTabChange(value as Tab)}
        className="space-y-0 hidden md:block"
      >
        <div className="border-b border-border">
          <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={customTabTriggerClassName}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="md:hidden">
        <Sheet open={isViewSheetOpen} onOpenChange={setIsViewSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="h-10 w-full justify-between gap-2 font-normal"
              aria-label="Choose submission view"
            >
              <span className="text-muted-foreground text-xs shrink-0">View</span>
              <span className="min-w-0 truncate text-left text-sm font-medium">
                {activeTabLabel}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[min(85vh,32rem)] rounded-t-xl">
            <SheetHeader className="text-left border-b border-border pb-3">
              <SheetTitle className="text-base">Submission view</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-0.5 overflow-y-auto py-2 pb-6" aria-label="Submission views">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={cn(
                    "flex w-full rounded-lg px-3 py-3 text-left text-sm transition-colors",
                    effectiveTab === tab.value
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  onClick={() => {
                    onTabChange(tab.value)
                    setIsViewSheetOpen(false)
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <ManualUploadDialog
        open={isCreateUploadDialogOpen}
        onOpenChange={setIsCreateUploadDialogOpen}
      />
    </div>
  )
}
