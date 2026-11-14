import { IconUserPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { api } from "../../../api.ts";
import { Alert, AlertDescription } from "../../../components/ui/Alert.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/Dialog.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Label } from "../../../components/ui/Label.tsx";

export const Route = createFileRoute("/dashboard/$organizationId/members")({
  component: Members,
});

function Members() {
  const { organization } = Route.useRouteContext();
  const [invited, setInvited] = useState<string>();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Members</h1>
        {/* Cosmetic: the Api refuses the invite without this permission either way. */}
        {organization.permissions.includes("members:write") && (
          <Invite organizationId={organization.id} onInvited={setInvited} />
        )}
      </div>
      {invited && (
        <Alert>
          <AlertDescription>
            Invited {invited}. They join by signing in to Blikka with that address.
          </AlertDescription>
        </Alert>
      )}
    </main>
  );
}

function Invite({ organizationId, onInvited }: { organizationId: string; onInvited: (email: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        setEmail("");
        setError(undefined);
      }}
    >
      <DialogTrigger render={<Button />}>
        <IconUserPlus />
        Invite
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            const { data, response } = await api().POST("/invitations", {
              body: { organization_id: organizationId, email: email.trim() },
            });
            setSubmitting(false);
            if (!data) {
              setError(response.status === 409 ? "They're already a member." : "Couldn't send the invitation. Try again.");
              return;
            }
            onInvited(data.email);
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>Members can manage the organization and all of its events.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>Email</Label>
            <Input
              id={id}
              type="email"
              autoFocus
              autoComplete="off"
              placeholder="name@example.com"
              required
              maxLength={254}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(undefined);
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !email.trim()}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
