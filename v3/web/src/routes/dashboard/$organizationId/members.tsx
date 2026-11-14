import { IconUserPlus } from "@tabler/icons-react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useId, useState } from "react";
import { api } from "../../../api.ts";
import { Badge } from "../../../components/ui/Badge.tsx";
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "../../../components/ui/Item.tsx";
import { Label } from "../../../components/ui/Label.tsx";
import { invitationsQuery } from "../../../invitations.ts";
import { membersQuery } from "../../../members.ts";

export const Route = createFileRoute("/dashboard/$organizationId/members")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(membersQuery(params.organizationId)),
      context.queryClient.ensureQueryData(invitationsQuery(params.organizationId)),
    ]),
  component: Members,
});

const roles = { owner: "Owner", admin: "Admin" };

function Members() {
  const { organization, session } = Route.useRouteContext();
  const { data: members } = useSuspenseQuery(membersQuery(organization.id));
  const { data: invitations } = useSuspenseQuery(invitationsQuery(organization.id));
  // Cosmetic: the Api refuses these without the permission either way.
  const canManage = organization.permissions.includes("members:write");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Members</h1>
        {canManage && <Invite organizationId={organization.id} />}
      </div>
      <ItemGroup>
        {members.map((member) => (
          <Item key={member.user_id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {member.name || member.email}
                {member.user_id === session?.user.id && <span className="text-muted-foreground">(you)</span>}
              </ItemTitle>
              {member.name && <ItemDescription>{member.email}</ItemDescription>}
            </ItemContent>
            <ItemActions>
              <Badge variant="secondary">{roles[member.role]}</Badge>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Invited</h2>
            <p className="text-sm text-muted-foreground">They join by signing in to Blikka with the invited address.</p>
          </div>
          <ItemGroup>
            {invitations.map((invitation) => (
              <PendingInvitation key={invitation.id} invitation={invitation} canManage={canManage} />
            ))}
          </ItemGroup>
        </section>
      )}
    </main>
  );
}

function PendingInvitation({
  invitation,
  canManage,
}: {
  invitation: { id: string; organization_id: string; email: string; expires_at: string };
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const expiresAt = new Date(invitation.expires_at);
  const expired = expiresAt <= new Date();

  // Refetches either way: a failure means it was accepted or revoked elsewhere.
  const act = async (request: () => Promise<unknown>) => {
    setBusy(true);
    await request();
    await queryClient.invalidateQueries({ queryKey: ["invitations"] });
    await queryClient.invalidateQueries({ queryKey: ["members"] });
    setBusy(false);
  };

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{invitation.email}</ItemTitle>
        <ItemDescription>
          {expired ? "Expired" : `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`}
        </ItemDescription>
      </ItemContent>
      {canManage && (
        <ItemActions>
          {expired && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                act(() =>
                  api().POST("/invitations", {
                    body: { organization_id: invitation.organization_id, email: invitation.email },
                  }),
                )
              }
            >
              Invite again
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => act(() => api().DELETE("/invitations/{id}", { params: { path: { id: invitation.id } } }))}
          >
            Revoke
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}

function Invite({ organizationId }: { organizationId: string }) {
  const id = useId();
  const queryClient = useQueryClient();
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
            if (!data) {
              setSubmitting(false);
              setError(response.status === 409 ? "They're already a member." : "Couldn't send the invitation. Try again.");
              return;
            }
            await queryClient.invalidateQueries({ queryKey: ["invitations"] });
            setSubmitting(false);
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
