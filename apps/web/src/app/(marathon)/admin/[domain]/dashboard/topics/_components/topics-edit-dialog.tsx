"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import type { Topic } from "@blikka/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";

interface EditTopicDialogProps {
  topic: Topic | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopicsEditDialog({
  topic,
  isOpen,
  onOpenChange,
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

  const form = useForm({
    defaultValues: {
      name: topic?.name ?? "",
      visibility: topic ? topic.visibility !== "private" : true,
    },
    onSubmit: async ({ value }) => {
      if (!topic) return;

      updateTopic({
        domain,
        id: topic.id,
        data: {
          name: value.name,
          visibility: (topic.visibility === "active" && value.visibility
            ? "active"
            : value.visibility
              ? "public"
              : "private") as "public" | "private" | "scheduled" | "active",
        },
      });
    },
  });

  useEffect(() => {
    if (!topic) {
      return;
    }

    form.setFieldValue("name", topic.name);
    form.setFieldValue("visibility", topic.visibility !== "private");
  }, [topic, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Topic</DialogTitle>
          <DialogDescription>
            Update the topic details here. Submission timing is managed from the
            active topic panel.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
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
          >
            {(field) => (
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
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Enter topic name"
                />
                {field.state.meta.isTouched &&
                field.state.meta.errors.length ? (
                  <p className="mt-1 text-sm text-destructive">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="visibility">
            {(field) => (
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
          </form.Field>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isUpdatingTopic}>
              {isUpdatingTopic ? "Saving..." : "Save changes"}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
