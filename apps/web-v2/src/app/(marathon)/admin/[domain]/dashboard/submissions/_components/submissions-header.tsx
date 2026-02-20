"use client";

import { Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryStates } from "nuqs";
import { submissionSearchParams } from "../_lib/search-params";
import Link from "next/link";
import { formatDomainPathname } from "@/lib/utils";

type Tab =
  | "all"
  | "initialized"
  | "not-verified"
  | "verified"
  | "validation-errors";

const customTabTriggerClassName =
  "relative py-4 px-0 text-sm font-medium transition-colors rounded-none bg-transparent border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#FF5D4B] dark:data-[state=active]:text-[#FF7A6B] text-muted-foreground hover:text-foreground data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[#FF5D4B] dark:data-[state=active]:after:bg-[#FF7A6B]";

interface SubmissionsHeaderProps {
  domain: string;
  marathonMode: string;
  activeTopicName: string | null;
  activeTopicOrderIndex: number | null;
}

export function SubmissionsHeader({
  domain,
  marathonMode,
  activeTopicName,
  activeTopicOrderIndex,
}: SubmissionsHeaderProps) {
  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  });

  const { tab: activeTab } = queryState;
  const onTabChange = (tab: Tab) => {
    setQueryState({ tab });
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "All Submissions" },
    { value: "initialized", label: "Initialized" },
    { value: "not-verified", label: "Not Verified" },
    { value: "verified", label: "Verified" },
    { value: "validation-errors", label: "Validation Errors" },
  ];

  return (
    <div className="space-y-4">
      {/* Title and Action Buttons */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="font-gothic text-3xl font-bold tracking-tight">
            Submissions
          </h1>
          {marathonMode === "by-camera" ? (
            <p className="text-muted-foreground text-sm">
              Viewing active topic:{" "}
              <span className="font-medium text-foreground">
                {activeTopicName
                  ? `${activeTopicOrderIndex !== null ? `#${activeTopicOrderIndex + 1} ` : ""}${activeTopicName}`
                  : "No active topic"}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              View and manage photo submissions from participants
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link
              href={formatDomainPathname("/admin/dashboard/voting", domain)}
            >
              <Vote className="h-4 w-4 mr-2" />
              Open Voting
            </Link>
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
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
    </div>
  );
}
