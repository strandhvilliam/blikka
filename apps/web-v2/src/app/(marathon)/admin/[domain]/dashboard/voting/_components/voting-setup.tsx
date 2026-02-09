import { useState } from "react";
import { addHours } from "date-fns";
import { Loader2, Vote, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  toDateTimeLocalValue,
  toIsoFromLocal,
  hasValidDateRange,
} from "./voting-utils";

interface VotingSetupProps {
  topicName: string;
  submissionCount: number;
  participantWithSubmissionCount: number;
  onStartVoting: (startsAt: string, endsAt: string) => Promise<void>;
  isStarting: boolean;
}

export function VotingSetup({
  topicName,
  submissionCount,
  participantWithSubmissionCount,
  onStartVoting,
  isStarting,
}: VotingSetupProps) {
  const [startsAtInput, setStartsAtInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  );
  const [endsAtInput, setEndsAtInput] = useState(() =>
    toDateTimeLocalValue(addHours(new Date(), 24)),
  );

  const launchStartsAtIso = toIsoFromLocal(startsAtInput);
  const launchEndsAtIso = toIsoFromLocal(endsAtInput);
  const canStartVoting =
    submissionCount > 0 &&
    hasValidDateRange(launchStartsAtIso, launchEndsAtIso);

  const handleStartVoting = () => {
    const startsAtIso = toIsoFromLocal(startsAtInput);
    const endsAtIso = toIsoFromLocal(endsAtInput);

    if (!startsAtIso || !endsAtIso) {
      toast.error("Please provide valid start and end timestamps");
      return;
    }

    if (!hasValidDateRange(startsAtIso, endsAtIso)) {
      toast.error("End timestamp must be later than start timestamp");
      return;
    }

    if (submissionCount === 0) {
      toast.error("No submissions are available for this topic");
      return;
    }

    onStartVoting(startsAtIso, endsAtIso);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Card className="border-slate-200 shadow-sm py-4">
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="font-rocgrotesk text-2xl">
            Before you start
          </CardTitle>
          <CardDescription>
            Verify readiness before creating voting sessions for this topic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Submissions in topic
              </p>
              <p className="mt-1 text-2xl font-semibold">{submissionCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                All uploads under <strong>{topicName}</strong>.
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Eligible participants
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {participantWithSubmissionCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                One session will be created for each participant.
              </p>
            </div>
          </div>

          {submissionCount === 0 ? (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No submissions yet</AlertTitle>
              <AlertDescription>
                Voting cannot start until at least one submission is uploaded for
                this topic.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Ready to launch</AlertTitle>
              <AlertDescription>
                Session generation will include all eligible participants with a
                submission on this topic.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border border-dashed p-4">
            <p className="text-sm font-medium">When voting starts</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Sessions are created for each eligible participant.</li>
              <li>Voting links become valid in the selected time window.</li>
              <li>Leaderboard updates automatically as votes are cast.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm py-4">
        <CardHeader className="pb-4">
          <CardTitle className="font-rocgrotesk text-2xl">
            Schedule voting window
          </CardTitle>
          <CardDescription>
            Set the start and end timestamps for participant voting sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voting-start-at">Start timestamp</Label>
            <Input
              id="voting-start-at"
              type="datetime-local"
              value={startsAtInput}
              onChange={(event) => setStartsAtInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voting-end-at">End timestamp</Label>
            <Input
              id="voting-end-at"
              type="datetime-local"
              value={endsAtInput}
              onChange={(event) => setEndsAtInput(event.target.value)}
            />
          </div>

          {!canStartVoting ? (
            <p className="text-xs text-muted-foreground">
              Set a valid time range with end later than start, and ensure at
              least one submission exists.
            </p>
          ) : null}

          <PrimaryButton
            onClick={handleStartVoting}
            disabled={isStarting || !canStartVoting}
            className="h-10 w-full"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting voting...
              </>
            ) : (
              <>
                <Vote className="mr-2 h-4 w-4" />
                Start Voting Sessions
              </>
            )}
          </PrimaryButton>
        </CardContent>
      </Card>
    </div>
  );
}
