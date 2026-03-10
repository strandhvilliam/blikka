"use client";

import { Plus, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryStates } from "nuqs";
import { submissionSearchParams } from "../_lib/search-params";
import { useEffect, useState } from "react";
import { AdminParticipantUploadDialog } from "./admin-participant-upload-dialog";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Button } from "@/components/ui/button";

function getActiveTopicDisplayText({
  activeTopicName,
  activeTopicOrderIndex,
}: {
  activeTopicName: string | null;
  activeTopicOrderIndex: number | null;
}) {
  if (!activeTopicName) return "No active topic";
  const orderPrefix =
    activeTopicOrderIndex !== null ? `#${activeTopicOrderIndex + 1} ` : "";
  return `${orderPrefix}${activeTopicName}`;
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
} as const;

type Tab = (typeof TAB)[keyof typeof TAB];

const customTabTriggerClassName =
  "relative py-4 px-0 text-sm font-medium transition-colors rounded-none bg-transparent border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#FF5D4B] dark:data-[state=active]:text-[#FF7A6B] text-muted-foreground hover:text-foreground data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[#FF5D4B] dark:data-[state=active]:after:bg-[#FF7A6B]";

export function SubmissionsHeader() {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );

  const activeByCameraTopic =
    marathon.mode === "by-camera"
      ? (marathon.topics.find((topic) => topic.visibility === "active") ?? null)
      : null;
  const activeTopicName = activeByCameraTopic?.name ?? null;
  const activeTopicOrderIndex = activeByCameraTopic?.orderIndex ?? null;

  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  });
  const [isCreateUploadDialogOpen, setIsCreateUploadDialogOpen] =
    useState(false);

  const { tab: activeTab } = queryState;

  const onTabChange = (tab: Tab) => {
    setQueryState({ tab });
  };

  const marathonTabs: { value: Tab; label: string }[] = [
    { value: TAB.ALL, label: "All Submissions" },
    { value: TAB.PREPARED, label: "Prepared" },
    { value: TAB.INITIALIZED, label: "Initialized" },
    { value: TAB.UPLOADED, label: "Uploaded" },
    { value: TAB.NOT_VERIFIED, label: "Not Verified" },
    { value: TAB.VERIFIED, label: "Verified" },
    { value: TAB.VALIDATION_ERRORS, label: "Validation Errors" },
  ];

  const byCameraTabs: { value: Tab; label: string }[] = [
    { value: TAB.ALL, label: "All Submissions" },
    { value: TAB.INITIALIZED, label: "Initialized" },
    { value: TAB.UPLOADED, label: "Uploaded" },
    { value: TAB.NOT_VOTED, label: "Not Voted" },
    { value: TAB.VOTED, label: "Voted" },
    { value: TAB.VALIDATION_ERRORS, label: "Validation Errors" },
  ];

  const tabs = marathon.mode === "by-camera" ? byCameraTabs : marathonTabs;

  const effectiveTab =
    marathon.mode === "by-camera" &&
    (activeTab === TAB.PREPARED ||
      activeTab === TAB.NOT_VERIFIED ||
      activeTab === TAB.VERIFIED)
      ? TAB.ALL
      : marathon.mode !== "by-camera" &&
          (activeTab === TAB.NOT_VOTED || activeTab === TAB.VOTED)
        ? TAB.ALL
        : activeTab;

  useEffect(() => {
    if (
      marathon.mode === "by-camera" &&
      (activeTab === TAB.PREPARED ||
        activeTab === TAB.NOT_VERIFIED ||
        activeTab === TAB.VERIFIED)
    ) {
      setQueryState({ tab: TAB.ALL });
    } else if (
      marathon.mode !== "by-camera" &&
      (activeTab === TAB.NOT_VOTED || activeTab === TAB.VOTED)
    ) {
      setQueryState({ tab: TAB.ALL });
    }
  }, [marathon.mode, activeTab, setQueryState]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="font-gothic text-3xl font-normal tracking-tight">
            Submissions
          </h1>
          {marathon.mode === "by-camera" ? (
            <p className="text-muted-foreground text-sm">
              Viewing active topic:{" "}
              <span className="font-medium text-foreground">
                {getActiveTopicDisplayText({
                  activeTopicName,
                  activeTopicOrderIndex,
                })}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              View and manage photo submissions from participants
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <PrimaryButton
            onClick={() => setIsCreateUploadDialogOpen(true)}
            className="bg-[#20201c] hover:bg-[#313129]"
          >
            <Plus className="h-4 w-4" />
            Add Participant Upload
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
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={customTabTriggerClassName}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <AdminParticipantUploadDialog
        open={isCreateUploadDialogOpen}
        onOpenChange={setIsCreateUploadDialogOpen}
      />
    </div>
  );
}
