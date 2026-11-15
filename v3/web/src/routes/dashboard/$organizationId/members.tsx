import { IconDots, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useId, useState } from "react";
import { isApiError } from "@/api/client.ts";
import { Badge } from "@/components/ui/Badge.tsx";
import { Button } from "@/components/ui/Button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog.tsx";
import { Input } from "@/components/ui/Input.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/Item.tsx";
import { Label } from "@/components/ui/Label.tsx";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu.tsx";
import { createInvitationMutation, invitationsQuery, revokeInvitationMutation } from "@/api/invitations.ts";
import {
  leaveOrganizationMutation,
  membersQuery,
  removeMemberMutation,
  transferOwnershipMutation,
} from "@/api/members.ts";

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
              <MemberActions
                member={member}
                organization={organization}
                isSelf={member.user_id === session?.user.id}
                canManage={canManage}
              />
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

type Action = "transfer" | "remove" | "leave";

// What the caller may do to this member. Cosmetic like canManage: the Api enforces the same rules (adr/0001).
function MemberActions({
  member,
  organization,
  isSelf,
  canManage,
}: {
  member: { user_id: string; name: string; email: string; role: "owner" | "admin" };
  organization: { id: string; name: string; role: "owner" | "admin" };
  isSelf: boolean;
  canManage: boolean;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const transfer = useMutation(transferOwnershipMutation(organization.id));
  const remove = useMutation(removeMemberMutation(organization.id));
  const leave = useMutation(leaveOrganizationMutation(organization.id));
  const [action, setAction] = useState<Action>();
  const actions: Array<Action> = [];
  if (organization.role === "owner" && !isSelf) actions.push("transfer");
  if (canManage && !isSelf && member.role !== "owner") actions.push("remove");
  if (isSelf && member.role !== "owner") actions.push("leave");
  if (actions.length === 0) return null;

  const who = member.name || member.email;
  const dialogs = {
    transfer: {
      label: "Make owner",
      title: `Make ${who} the owner?`,
      description: "An organization has one owner. You'll become an admin, and only the new owner can hand it back.",
      confirm: () => transfer.mutateAsync(member.user_id).then(() => router.invalidate()),
      failure: "Couldn't hand over ownership. Try again.",
    },
    remove: {
      label: "Remove",
      title: `Remove ${who}?`,
      description: `They lose access to ${organization.name} and its events. You can invite them again later.`,
      confirm: () => remove.mutateAsync(member.user_id),
      failure: "Couldn't remove them. Try again.",
    },
    leave: {
      label: "Leave organization",
      title: `Leave ${organization.name}?`,
      description: "You lose access to it and its events. An admin can invite you again.",
      confirm: () => leave.mutateAsync(member.user_id).then(() => navigate({ to: "/dashboard" })),
      failure: "Couldn't leave the organization. Try again.",
    },
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${who}`} />}>
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a) => (
            <DropdownMenuItem key={a} variant={a === "transfer" ? "default" : "destructive"} onClick={() => setAction(a)}>
              {dialogs[a].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {action && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAction(undefined)}
          title={dialogs[action].title}
          description={dialogs[action].description}
          action={dialogs[action].label}
          onConfirm={dialogs[action].confirm}
          failure={dialogs[action].failure}
        />
      )}
    </>
  );
}

function PendingInvitation({
  invitation,
  canManage,
}: {
  invitation: { id: string; organization_id: string; email: string; expires_at: string };
  canManage: boolean;
}) {
  const invite = useMutation(createInvitationMutation(invitation.organization_id));
  const revoke = useMutation(revokeInvitationMutation(invitation.organization_id));
  const busy = invite.isPending || revoke.isPending;
  const expiresAt = new Date(invitation.expires_at);
  const expired = expiresAt <= new Date();

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
              onClick={() => invite.mutate(invitation.email)}
            >
              Invite again
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => revoke.mutate(invitation.id)}
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
  const invite = useMutation(createInvitationMutation(organizationId));
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const error =
    invite.error &&
    (isApiError(invite.error, "AlreadyMember")
      ? "They're already a member."
      : "Couldn't send the invitation. Try again.");

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        setEmail("");
        invite.reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <IconUserPlus />
        Invite
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate(email.trim(), { onSuccess: () => setOpen(false) });
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
                if (invite.isError) invite.reset();
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={invite.isPending || !email.trim()}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
