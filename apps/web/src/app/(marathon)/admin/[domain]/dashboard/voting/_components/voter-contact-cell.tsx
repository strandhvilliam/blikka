"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Mail, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { cn } from "@/lib/utils";

type ContactKind = "email" | "phone";

type VoterContactCellProps = {
  kind: ContactKind;
  sessionId: number;
  topicId: number;
  value: string | null;
};

export function VoterContactCell({
  kind,
  sessionId,
  topicId,
  value,
}: VoterContactCellProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const domain = useDomain();

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const display = value?.trim() ? value.trim() : null;

  const updateMutation = useMutation(
    trpc.voting.updateVotingSessionContact.mutationOptions({
      onSuccess: async () => {
        toast.success(
          kind === "email" ? "Email updated" : "Phone number updated",
        );
        setEditOpen(false);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Update failed");
      },
    }),
  );

  const openEdit = (next: boolean) => {
    if (next) {
      setDraft(display ?? "");
    }
    setEditOpen(next);
  };

  const handleCopy = async () => {
    if (!display) return;
    await navigator.clipboard.writeText(display);
    toast.success(
      kind === "email" ? "Email copied" : "Phone number copied",
    );
  };

  const handleSave = () => {
    if (kind === "email") {
      updateMutation.mutate({
        domain,
        topicId,
        sessionId,
        email: draft,
      });
    } else {
      updateMutation.mutate({
        domain,
        topicId,
        sessionId,
        phoneNumber: draft,
      });
    }
  };

  const fieldLabel = kind === "email" ? "email address" : "phone number";
  const Icon = kind === "email" ? Mail : Phone;

  const editPopover = (
    <Popover open={editOpen} onOpenChange={openEdit}>
      {display ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground opacity-0 ring-1 ring-transparent transition-all hover:bg-background hover:text-foreground hover:ring-border hover:shadow-sm group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:ring-border"
                aria-label={`Edit ${fieldLabel}`}
              >
                <Pencil className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Edit {fieldLabel}</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add {kind}
          </Button>
        </PopoverTrigger>
      )}
      <PopoverContent
        className="w-[min(20rem,calc(100vw-2rem))] p-3"
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`voter-${kind}-${sessionId}`}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <Icon className="size-3.5" />
              {kind === "email" ? "Email address" : "Phone number"}
            </label>
            <Input
              id={`voter-${kind}-${sessionId}`}
              type={kind === "email" ? "email" : "tel"}
              autoComplete={kind === "email" ? "email" : "tel"}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                kind === "email" ? "name@example.com" : "+46 70 123 45 67"
              }
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !updateMutation.isPending) {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditOpen(false);
                }
              }}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              {kind === "phone"
                ? "Use international format. Leave empty to remove."
                : "Leave empty to remove the email."}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setEditOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!display) {
    return <div className="flex min-h-8 items-center">{editPopover}</div>;
  }

  return (
    <div
      className={cn(
        "group flex w-full min-w-0 max-w-64 items-center gap-0.5 rounded-md",
      )}
    >
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={cn(
                "flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm ring-1 ring-transparent transition-all",
                "hover:bg-background hover:ring-border hover:shadow-sm",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  kind === "phone" && "tabular-nums",
                )}
              >
                {display}
              </span>
              <Copy className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Click to copy</TooltipContent>
        </Tooltip>
      </div>
      {editPopover}
    </div>
  );
}
