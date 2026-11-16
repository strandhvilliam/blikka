import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { authClient } from "@/api/authClient.ts";
import {
  acceptInvitationMutation,
  invitedBy,
  receivedInvitationsQuery,
  type ReceivedInvitations,
} from "@/api/invitations.ts";
import { createOrganizationMutation } from "@/api/organizations.ts";
import { sessionQuery, useSignOut } from "@/api/session.ts";
import { Step, Steps } from "@/components/Step.tsx";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }

    return { session: context.session };
  },
  // fetchQuery, not ensureQueryData, so an invitation sent since the last visit shows up.
  loader: ({ context }) => context.queryClient.fetchQuery(receivedInvitationsQuery),
  component: Onboarding,
});

function Onboarding() {
  const { session } = Route.useRouteContext();
  const { data: invitations } = useSuspenseQuery(receivedInvitationsQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createOrganization = useMutation(createOrganizationMutation);
  // Email-code sign-ups start with an empty name; Google sign-ups bring theirs and skip the step.
  const [asksName] = useState(!session.user.name.trim());
  const [invited] = useState(invitations.length > 0);
  const afterName = invited ? "invitations" : "organization";
  const [step, setStep] = useState(asksName ? "name" : afterName);
  const [name, setName] = useState(session.user.name.trim());
  const [organization, setOrganization] = useState("");
  const firstName = name.split(" ")[0];
  const greeting = `${asksName ? "Nice to meet you" : "Welcome"}, ${firstName}.`;

  const signOut = useSignOut();

  return (
    <main className="flex min-h-svh flex-col items-center p-6">
      <div className="flex w-full flex-1 items-center justify-center">
        {step === "name" ? (
          <Step
            key="name"
            question="What's your name?"
            hint="So your team knows who's who."
            complete={!!name.trim()}
            progress={asksName ? [1, 2] : undefined}
            submit={async () => {
              const { error } = await authClient.updateUser({ name: name.trim() });

              if (error) {
                return "Couldn't save your name. Try again.";
              }

              await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
              setStep(afterName);
            }}
          >
            {(labelId) => <Answer labelId={labelId} autoComplete="name" value={name} onChange={setName} />}
          </Step>
        ) : step === "invitations" ? (
          <Invitations
            key="invitations"
            greeting={greeting}
            invitations={invitations}
            progress={asksName ? [2, 2] : undefined}
            back={asksName ? () => setStep("name") : undefined}
            createOwn={() => setStep("organization")}
          />
        ) : (
          <Step
            key="organization"
            greeting={invited ? undefined : greeting}
            question="What's your organization called?"
            hint="The club, company or team behind your events."
            complete={!!organization.trim()}
            progress={asksName && !invited ? [2, 2] : undefined}
            back={invited ? () => setStep("invitations") : asksName ? () => setStep("name") : undefined}
            submit={() =>
              createOrganization.mutateAsync(organization.trim()).then(
                (created) => navigate({ to: "/dashboard/$organizationId", params: { organizationId: created.id } }),
                () => "Couldn't create your organization. Try again.",
              )
            }
          >
            {(labelId) => (
              <Answer
                labelId={labelId}
                placeholder="Malmö Photo Club"
                autoComplete="organization"
                value={organization}
                onChange={setOrganization}
              />
            )}
          </Step>
        )}
      </div>
      {/* The gate sends anyone without an org back here, so this is the only way out of the wrong account. */}
      <p className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
        Signed in as {session.user.email}
        <Button onClick={signOut}>Sign out</Button>
      </p>
    </main>
  );
}

function Invitations({
  greeting,
  invitations,
  progress,
  back,
  createOwn,
}: {
  greeting: string;
  invitations: ReceivedInvitations;
  progress?: [step: number, of: number];
  back?: () => void;
  createOwn: () => void;
}) {
  const accept = useMutation(acceptInvitationMutation);
  const navigate = useNavigate();
  // isSuccess too, so a second click while moving on can't join twice.
  const joining = accept.isPending || accept.isSuccess;

  const join = (id: string) =>
    accept.mutate(id, {
      onSuccess: ({ organization_id }) =>
        navigate({ to: "/dashboard/$organizationId", params: { organizationId: organization_id } }),
    });

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 text-center">
      {progress && <Steps progress={progress} />}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">{greeting}</p>
        <h1 className="text-2xl font-semibold">You've been invited</h1>
        <p className="text-sm text-balance text-muted-foreground">Join to run events together with your team.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex items-center gap-4 py-3 text-left">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{invitation.organization.name}</span>
              <span className="text-sm wrap-anywhere text-muted-foreground">{invitedBy(invitation)}</span>
            </div>
            <Button data-variant="solid" disabled={joining} onClick={() => join(invitation.id)}>
              Join
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <Button disabled={joining} onClick={createOwn}>
          Create my own organization instead
        </Button>
        {back && (
          <Button disabled={joining} onClick={back}>
            Back
          </Button>
        )}
      </div>
      {accept.isError && (
        <p role="alert" className="text-sm text-destructive">
          That invitation is no longer open.
        </p>
      )}
    </div>
  );
}

// The keyboard comes up with the question.
function Answer({
  labelId,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  labelId: string;
  placeholder?: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      aria-labelledby={labelId}
      autoFocus
      autoComplete={autoComplete}
      placeholder={placeholder}
      required
      maxLength={100}
      value={value}
      onValueChange={onChange}
    />
  );
}
