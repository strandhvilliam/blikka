import { IconDots, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useRef, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { isApiError } from "@/api/client.ts";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { createInvitationMutation, invitationsQuery, revokeInvitationMutation } from "@/api/invitations.ts";
import {
  leaveOrganizationMutation,
  membersQuery,
  removeMemberMutation,
  transferOwnershipMutation,
} from "@/api/members.ts";

import { PageHeader } from "@/components/PageHeader.tsx";

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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <PageHeader title="Members" description="People who can run this organization's events.">
        {canManage && <Invite organizationId={organization.id} />}
      </PageHeader>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {members.map((member) => (
          <li key={member.user_id} className="flex items-center gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium wrap-anywhere">
                {member.name || member.email}
                {member.user_id === session?.user.id && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {member.name && <span className="text-sm wrap-anywhere text-muted-foreground">{member.email}</span>}
            </div>
            <span className="text-sm text-muted-foreground">{roles[member.role]}</span>
            <MemberActions
              member={member}
              organization={organization}
              isSelf={member.user_id === session?.user.id}
              canManage={canManage}
            />
          </li>
        ))}
      </ul>
      {invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Invited</h2>
            <p className="text-sm text-muted-foreground">They join by signing in to Blikka with the invited address.</p>
          </div>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {invitations.map((invitation) => (
              <PendingInvitation key={invitation.id} invitation={invitation} canManage={canManage} />
            ))}
          </ul>
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
  // Kept after closing, so the dialog keeps its words while it animates out.
  const [action, setAction] = useState<Action>();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const actions: Array<Action> = [];

  if (organization.role === "owner" && !isSelf) {
    actions.push("transfer");
  }

  if (canManage && !isSelf && member.role !== "owner") {
    actions.push("remove");
  }

  if (isSelf && member.role !== "owner") {
    actions.push("leave");
  }

  if (actions.length === 0) {
    return null;
  }

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
      <Menu>
        <MenuTrigger ref={trigger} aria-label={`Actions for ${who}`}>
          <IconDots aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          {actions.map((a) => (
            <MenuItem
              key={a}
              destructive={a !== "transfer"}
              onSelect={() => {
                setAction(a);
                setOpen(true);
              }}
            >
              {dialogs[a].label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {action && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={dialogs[action].title}
          description={dialogs[action].description}
          action={dialogs[action].label}
          onConfirm={dialogs[action].confirm}
          failure={dialogs[action].failure}
          finalFocus={() => trigger.current}
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
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const expired = expiresAt <= new Date();

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium wrap-anywhere">{invitation.email}</span>
        <span className="text-sm text-muted-foreground">
          {expired ? "Expired" : `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`}
        </span>
      </div>
      {canManage && (
        <div className="flex gap-1">
          {expired && (
            <Button disabled={busy} onClick={() => invite.mutate(invitation.email)}>
              Invite again
            </Button>
          )}
          <Button disabled={busy} onClick={() => revoke.mutate(invitation.id)}>
            Revoke
          </Button>
        </div>
      )}
    </li>
  );
}

function Invite({ organizationId }: { organizationId: string }) {
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
      <DialogTrigger data-variant="solid">
        <IconUserPlus aria-hidden />
        Invite
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Invite a member</DialogTitle>
        <DialogDescription>Members can manage the organization and all of its events.</DialogDescription>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate(email.trim(), { onSuccess: () => setOpen(false) });
          }}
        >
          <Field invalid={error ? true : undefined}>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              autoFocus
              autoComplete="off"
              placeholder="name@example.com"
              required
              maxLength={254}
              value={email}
              onValueChange={(value) => {
                setEmail(value);

                if (invite.isError) {
                  invite.reset();
                }
              }}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" data-variant="solid" className="self-end" disabled={invite.isPending || !email.trim()}>
            Send invitation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
