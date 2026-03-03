"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { useEffect } from "react";
import type { Topic } from "@blikka/db";

interface EditTopicDialogProps {
  topic: Topic | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  showActiveToggle?: boolean;
}

export function TopicsEditDialog({
  topic,
  isOpen,
  onOpenChange,
  showActiveToggle = false,
}: EditTopicDialogProps) {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate: updateTopic, isPending: isUpdatingTopic } = useMutation(
    trpc.topics.update.mutationOptions({
      onError: (error) => {
        toast.error("Failed to update topic", {
          description: error.message,
        });
      },
      onSuccess: () => {
        toast.success("Topic updated");
        onOpenChange(false);
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
      },
    }),
  );

  const { mutate: activateTopic, isPending: isActivatingTopic } = useMutation(
    trpc.topics.activate.mutationOptions({
      onError: (error) => {
        toast.error("Failed to activate topic", {
          description: error.message,
        });
      },
      onSuccess: () => {
        toast.success("Topic activated");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: topic?.name || "",
      visibility: topic ? topic.visibility !== "private" : true,
      activate: topic ? topic.visibility === "active" : false,
    },
    onSubmit: async ({ value }) => {
      if (!topic) return;

      const visibility = value.visibility ? "public" : "private";
      const shouldActivate =
        showActiveToggle && value.activate && topic.visibility !== "active";
      const shouldKeepActive =
        topic.visibility === "active" && value.visibility;

      // Update topic fields
      updateTopic({
        domain,
        id: topic.id,
        data: {
          name: value.name,
          visibility: (shouldKeepActive
            ? "active"
            : visibility) as "public" | "private" | "scheduled" | "active",
        },
      });

      // Activate topic separately if needed
      if (shouldActivate) {
        activateTopic({
          domain,
          id: topic.id,
        });
      }
    },
  });

  useEffect(() => {
    if (topic) {
      form.setFieldValue("name", topic.name);
      form.setFieldValue("visibility", topic.visibility !== "private");
      form.setFieldValue("activate", topic.visibility === "active");
    }
  }, [topic, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Topic</DialogTitle>
          <DialogDescription>
            Make changes to the topic details here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.length < 1) {
                  return "Name is required";
                }
                return undefined;
              },
            }}
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Name
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter topic name"
                />
                {field.state.meta.isTouched &&
                field.state.meta.errors.length ? (
                  <p className="text-sm text-destructive mt-1">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          />

          <form.Field
            name="visibility"
            children={(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Visibility
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Make topic visible to participants
                  </p>
                </div>
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(!!checked)}
                />
              </div>
            )}
          />

          {showActiveToggle ? (
            <form.Field
              name="activate"
              children={(field) => (
                <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Make active
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Mark this topic as the active one
                    </p>
                  </div>
                  <Switch
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                    disabled={topic?.visibility === "active"}
                  />
                </div>
              )}
            />
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
              size="sm"
            >
              Cancel
            </Button>
            <PrimaryButton
              type="submit"
              disabled={isUpdatingTopic || isActivatingTopic}
            >
              {isUpdatingTopic || isActivatingTopic
                ? "Saving..."
                : "Save changes"}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
