import { useState, useEffect } from "react";
import { addHours } from "date-fns";
import { Copy, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
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
import {
  toDateTimeLocalValue,
  toIsoFromLocal,
  hasValidDateRange,
} from "./voting-utils";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateInvite: (data: {
    firstName: string;
    lastName: string;
    email: string;
    startsAt: string;
    endsAt: string;
  }) => void;
  createdInviteUrl: string | null;
  votingWindowStartsAt?: string | null;
  votingWindowEndsAt?: string | null;
  isCreating: boolean;
  onReset?: () => void;
}

export function InviteDialog({
  open,
  onOpenChange,
  onCreateInvite,
  createdInviteUrl,
  votingWindowStartsAt,
  votingWindowEndsAt,
  isCreating,
  onReset,
}: InviteDialogProps) {
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStartsAtInput, setInviteStartsAtInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  );
  const [inviteEndsAtInput, setInviteEndsAtInput] = useState(() =>
    toDateTimeLocalValue(addHours(new Date(), 24)),
  );

  useEffect(() => {
    if (open && !createdInviteUrl) {
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");

      const startsAt = votingWindowStartsAt
        ? toDateTimeLocalValue(new Date(votingWindowStartsAt))
        : toDateTimeLocalValue(new Date());
      const endsAt = votingWindowEndsAt
        ? toDateTimeLocalValue(new Date(votingWindowEndsAt))
        : toDateTimeLocalValue(addHours(new Date(), 24));

      setInviteStartsAtInput(startsAt);
      setInviteEndsAtInput(endsAt);
    }
  }, [open, createdInviteUrl, votingWindowStartsAt, votingWindowEndsAt]);

  const handleCreateManualInvite = () => {
    const startsAtIso = toIsoFromLocal(inviteStartsAtInput);
    const endsAtIso = toIsoFromLocal(inviteEndsAtInput);

    if (!startsAtIso || !endsAtIso) {
      toast.error("Please provide valid start and end timestamps");
      return;
    }

    if (!hasValidDateRange(startsAtIso, endsAtIso)) {
      toast.error("End timestamp must be later than start timestamp");
      return;
    }

    onCreateInvite({
      firstName: inviteFirstName,
      lastName: inviteLastName,
      email: inviteEmail,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
  };

  const handleCopyInviteLink = async () => {
    if (!createdInviteUrl) return;
    await navigator.clipboard.writeText(createdInviteUrl);
    toast.success("Invite link copied to clipboard");
  };

  const handleReset = () => {
    setInviteFirstName("");
    setInviteLastName("");
    setInviteEmail("");
    onReset?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create manual voting invite</DialogTitle>
          <DialogDescription>
            Create a voting session for a non-participant voter and copy the
            generated link.
          </DialogDescription>
        </DialogHeader>

        {createdInviteUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="created-vote-link">Invite link</Label>
              <div className="flex gap-2">
                <Input
                  id="created-vote-link"
                  value={createdInviteUrl}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyInviteLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleReset}>
                Create Another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First name</Label>
                <Input
                  id="invite-first-name"
                  value={inviteFirstName}
                  onChange={(event) => setInviteFirstName(event.target.value)}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last name</Label>
                <Input
                  id="invite-last-name"
                  value={inviteLastName}
                  onChange={(event) => setInviteLastName(event.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="voter@example.com"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-start-at">Start timestamp</Label>
                <Input
                  id="invite-start-at"
                  type="datetime-local"
                  value={inviteStartsAtInput}
                  onChange={(event) =>
                    setInviteStartsAtInput(event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-end-at">End timestamp</Label>
                <Input
                  id="invite-end-at"
                  type="datetime-local"
                  value={inviteEndsAtInput}
                  onChange={(event) =>
                    setInviteEndsAtInput(event.target.value)
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={handleCreateManualInvite}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating invite...
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Create Invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
