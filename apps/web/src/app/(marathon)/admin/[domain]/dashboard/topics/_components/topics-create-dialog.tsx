"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
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
import { Switch } from "@/components/ui/switch";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";

interface CreateTopicDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  showActiveToggle?: boolean;
  defaultActive?: boolean;
}

export function TopicsCreateDialog({
  isOpen,
  onOpenChange,
  showActiveToggle = false,
  defaultActive = true,
}: CreateTopicDialogProps) {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate: createTopic, isPending: isCreatingTopic } = useMutation(
    trpc.topics.create.mutationOptions({
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
        toast.success("Topic created");
      },
      onError: (error) => {
        toast.error(error.message);
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.uploadFlow.getPublicMarathon.queryKey({ domain }),
        });
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      visibility: true,
      activate: showActiveToggle ? defaultActive : false,
    },
    onSubmit: async ({ value }) => {
      createTopic({
        domain,
        data: {
          name: value.name,
          visibility: (value.visibility ? "public" : "private") as
            | "public"
            | "private"
            | "scheduled"
            | "active",
          ...(showActiveToggle && value.activate ? { activate: true } : {}),
        },
      });
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Topic</DialogTitle>
          <DialogDescription>
            Add a new topic to your marathon. You can open submissions later
            from the active topic panel.
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

          {showActiveToggle ? (
            <form.Field name="activate">
              {(field) => (
                <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Make active
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Mark this topic as the active one. Submissions stay closed
                      until you open them from the active topic panel.
                    </p>
                  </div>
                  <Switch
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                  />
                </div>
              )}
            </form.Field>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isCreatingTopic}>
              {isCreatingTopic ? "Creating..." : "Create Topic"}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
