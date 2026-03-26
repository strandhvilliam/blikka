"use client";

import { useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import type { Topic } from "@blikka/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Clock3,
  Lock,
  Play,
  RotateCcw,
  TimerOff,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrimaryButton } from "@/components/ui/primary-button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { getByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state";
import {
  formatTimestamp,
  toDateTimeLocalValue,
  toIsoFromLocal,
} from "../_lib/formatting";

type SubmissionWindowMode = "now" | "schedule";

interface TopicsSubmissionWindowDialogProps {
  topic: Topic | null;
  votingHasStarted: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function getSubmissionWindowDefaults(topic: Topic | null) {
  const scheduledStart = topic?.scheduledStart
    ? new Date(topic.scheduledStart)
    : null;
  const scheduledEnd = topic?.scheduledEnd
    ? new Date(topic.scheduledEnd)
    : null;
  const now = new Date();

  return {
    mode:
      scheduledStart && scheduledStart > now
        ? ("schedule" as SubmissionWindowMode)
        : ("now" as SubmissionWindowMode),
    scheduledStart:
      scheduledStart && scheduledStart > now
        ? toDateTimeLocalValue(scheduledStart)
        : "",
    scheduledEnd: scheduledEnd ? toDateTimeLocalValue(scheduledEnd) : "",
  };
}

export function TopicsSubmissionWindowDialog({
  topic,
  votingHasStarted,
  isOpen,
  onOpenChange,
}: TopicsSubmissionWindowDialogProps) {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate: updateTopic, isPending: isUpdatingTopic } = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: () => {
        toast.success("Submission window updated");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error("Failed to update submission window", {
          description: error.message,
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
      },
    }),
  );

  const form = useForm({
    defaultValues: getSubmissionWindowDefaults(topic),
    onSubmit: async ({ value }) => {
      if (!topic) {
        return;
      }

      if (topic.visibility !== "active") {
        toast.error("Only the active topic can manage submissions");
        return;
      }

      const submissionClosed =
        getByCameraSubmissionWindowState(topic) === "closed";

      if (submissionClosed && votingHasStarted) {
        toast.error("Voting has already started; submissions cannot be reopened");
        return;
      }

      const existingStart =
        topic.scheduledStart && new Date(topic.scheduledStart) <= new Date()
          ? topic.scheduledStart
          : null;
      let scheduledStartIso: string | null;
      if (submissionClosed && topic.scheduledStart) {
        scheduledStartIso = topic.scheduledStart;
      } else if (value.mode === "now") {
        scheduledStartIso = existingStart ?? new Date().toISOString();
      } else {
        scheduledStartIso = toIsoFromLocal(value.scheduledStart);
      }

      if (!submissionClosed && value.mode === "schedule" && !scheduledStartIso) {
        toast.error("Choose when submissions should open");
        return;
      }

      const scheduledEndIso = value.scheduledEnd
        ? toIsoFromLocal(value.scheduledEnd)
        : null;

      if (value.scheduledEnd && !scheduledEndIso) {
        toast.error("Choose a valid submission end");
        return;
      }

      if (
        scheduledStartIso &&
        scheduledEndIso &&
        new Date(scheduledEndIso) <= new Date(scheduledStartIso)
      ) {
        toast.error("Submission end must be after the submission start");
        return;
      }

      updateTopic({
        domain,
        id: topic.id,
        data: {
          scheduledStart: scheduledStartIso,
          scheduledEnd: scheduledEndIso,
        },
      });
    },
  });

  const formValues = useStore(form.store, (state) => state.values);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const defaults = getSubmissionWindowDefaults(topic);
    form.setFieldValue("mode", defaults.mode);
    form.setFieldValue("scheduledStart", defaults.scheduledStart);
    form.setFieldValue("scheduledEnd", defaults.scheduledEnd);
  }, [form, isOpen, topic]);

  const isActiveTopic = topic?.visibility === "active";
  const submissionState = topic
    ? getByCameraSubmissionWindowState(topic)
    : null;
  const isSubmissionClosed = submissionState === "closed";
  const submissionClosedReadOnly = isSubmissionClosed && votingHasStarted;
  const canReopenAfterClose =
    isActiveTopic && isSubmissionClosed && !votingHasStarted;
  const isCurrentlyOpen =
    isActiveTopic &&
    topic &&
    topic.scheduledStart != null &&
    new Date(topic.scheduledStart) <= new Date() &&
    (topic.scheduledEnd == null || new Date(topic.scheduledEnd) > new Date());

  const dialogTitle = submissionClosedReadOnly
    ? "Submission window closed"
    : canReopenAfterClose
      ? "Reopen submissions"
      : topic?.scheduledStart
        ? "Edit submission window"
        : "Start submissions";

  const handleReopenOpenEnded = () => {
    if (!topic || !canReopenAfterClose) {
      return;
    }

    updateTopic({
      domain,
      id: topic.id,
      data: { scheduledEnd: null },
    });
  };

  const handleCloseNow = () => {
    if (!topic || !isCurrentlyOpen) {
      return;
    }

    updateTopic({
      domain,
      id: topic.id,
      data: {
        scheduledEnd: new Date().toISOString(),
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {submissionClosedReadOnly
              ? `Voting is underway for ${topic?.name ?? "this topic"}. Submissions cannot be reopened from here.`
              : canReopenAfterClose
                ? `Submissions have ended for ${topic?.name ?? "this topic"}. You can open them again until voting starts.`
                : `Open submissions immediately or schedule when uploads should start for ${topic?.name ?? "this topic"}.`}
          </DialogDescription>
        </DialogHeader>

        {!isActiveTopic ? (
          <>
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Active topic required</AlertTitle>
              <AlertDescription>
                Submission timing can only be edited for the current active topic.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {isActiveTopic && submissionClosedReadOnly ? (
          <>
            <Alert variant="destructive">
              <Lock />
              <AlertTitle>Voting has started</AlertTitle>
              <AlertDescription>
                The submission window cannot be reopened because voting is
                already underway for this topic. Manage deadlines from the
                voting page if you need to adjust voting.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {isActiveTopic && canReopenAfterClose ? (
          <Alert>
            <TimerOff />
            <AlertTitle>Window ended</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>
                Submissions closed at{" "}
                <span className="font-medium text-foreground">
                  {topic?.scheduledEnd
                    ? formatTimestamp(topic.scheduledEnd)
                    : "—"}
                </span>
                .
              </p>
              <p>
                Use <span className="font-medium text-foreground">Reopen</span>{" "}
                to allow uploads again with no fixed closing time, or set a new
                closing time below.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {isActiveTopic && !submissionClosedReadOnly ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-5"
          >
            {canReopenAfterClose ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleReopenOpenEnded}
                  disabled={isUpdatingTopic}
                >
                  <RotateCcw className="size-3.5" />
                  Reopen (no closing time)
                </Button>
              </div>
            ) : null}

            {!canReopenAfterClose ? (
              <form.Field name="mode">
                {(field) => (
                  <div className="space-y-3">
                    <Label>How should submissions open?</Label>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(value as SubmissionWindowMode)
                      }
                      className="gap-3"
                      disabled={!isActiveTopic || isUpdatingTopic}
                    >
                      <label
                        htmlFor="submission-mode-now"
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                          field.state.value === "now"
                            ? "border-brand-primary bg-brand-primary/5"
                            : "border-border bg-card",
                        )}
                      >
                        <RadioGroupItem id="submission-mode-now" value="now" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Play className="size-4" />
                            Open for submissions now
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Save the current time as the submission start.
                          </p>
                        </div>
                      </label>

                      <label
                        htmlFor="submission-mode-schedule"
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                          field.state.value === "schedule"
                            ? "border-brand-primary bg-brand-primary/5"
                            : "border-border bg-card",
                        )}
                      >
                        <RadioGroupItem
                          id="submission-mode-schedule"
                          value="schedule"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Clock3 className="size-4" />
                            Set a scheduled start
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Keep uploads closed until the selected time.
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>
                )}
              </form.Field>
            ) : null}

            {!canReopenAfterClose && formValues.mode === "schedule" ? (
              <form.Field name="scheduledStart">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-start">Submissions open at</Label>
                    <Input
                      id="scheduled-start"
                      type="datetime-local"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      disabled={!isActiveTopic || isUpdatingTopic}
                    />
                  </div>
                )}
              </form.Field>
            ) : null}

            <form.Field name="scheduledEnd">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="scheduled-end">
                    {canReopenAfterClose
                      ? "New submissions close at"
                      : "Submissions end at"}
                  </Label>
                  <Input
                    id="scheduled-end"
                    type="datetime-local"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={!isActiveTopic || isUpdatingTopic}
                  />
                  <p className="text-xs text-muted-foreground">
                    {canReopenAfterClose
                      ? "Optional. Leave empty to keep submissions open until you close them again."
                      : "Optional. Leave empty to keep submissions open until you set an end time later."}
                  </p>
                </div>
              )}
            </form.Field>

            <DialogFooter>
              {isCurrentlyOpen ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseNow}
                  disabled={isUpdatingTopic}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Close now
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isUpdatingTopic}
              >
                Cancel
              </Button>
              <PrimaryButton
                type="submit"
                disabled={!isActiveTopic || isUpdatingTopic}
              >
                {isUpdatingTopic
                  ? "Saving..."
                  : canReopenAfterClose
                    ? "Save closing time"
                    : "Save submission window"}
              </PrimaryButton>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
