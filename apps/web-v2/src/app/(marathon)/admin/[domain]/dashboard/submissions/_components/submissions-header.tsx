"use client";

import { useState } from "react";
import { Vote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryState, useQueryStates } from "nuqs";
import { submissionSearchParams } from "../_lib/search-params";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
}

export function SubmissionsHeader({ domain }: SubmissionsHeaderProps) {
  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  });
  const [isStartVotingDialogOpen, setIsStartVotingDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { tab: activeTab } = queryState;
  const onTabChange = (tab: Tab) => {
    setQueryState({ tab });
  };

  const { mutate: startVotingSessions, isPending: isStartingVoting } =
    useMutation(
      trpc.voting.startVotingSessions.mutationOptions({
        onSuccess: () => {
          toast.success("Voting sessions started successfully");
          setIsStartVotingDialogOpen(false);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to start voting sessions");
          setIsStartVotingDialogOpen(false);
        },
      }),
    );

  const handleStartVoting = () => {
    startVotingSessions({ domain });
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
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
            Submissions
          </h1>
          <p className="text-muted-foreground text-sm">
            View and manage photo submissions from participants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsStartVotingDialogOpen(true)}
            disabled={isStartingVoting}
          >
            {isStartingVoting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Vote className="h-4 w-4 mr-2" />
            )}
            Start Voting Sessions
          </Button>
        </div>
      </div>

      <AlertDialog
        open={isStartVotingDialogOpen}
        onOpenChange={setIsStartVotingDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-rocgrotesk">
              Start Voting Sessions
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to start voting sessions? This will create
              voting sessions for all eligible participants and cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStartingVoting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartVoting}
              disabled={isStartingVoting}
              className="bg-primary hover:bg-primary/90"
            >
              {isStartingVoting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Vote className="h-4 w-4 mr-2" />
                  Start Voting Sessions
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
