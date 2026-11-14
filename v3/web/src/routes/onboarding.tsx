import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { api } from "../api.ts";
import { authClient } from "../authClient.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "../components/ui/Item.tsx";
import { receivedInvitationsQuery, type ReceivedInvitations } from "../invitations.ts";
import { sessionQuery, useSignOut } from "../session.ts";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" });
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
            autoComplete="name"
            value={name}
            onChange={setName}
            progress={asksName ? [1, 2] : undefined}
            submit={async () => {
              const { error } = await authClient.updateUser({ name: name.trim() });
              if (error) return "Couldn't save your name. Try again.";
              await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
              setStep(afterName);
            }}
          />
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
            placeholder="Malmö Photo Club"
            autoComplete="organization"
            value={organization}
            onChange={setOrganization}
            progress={asksName && !invited ? [2, 2] : undefined}
            back={invited ? () => setStep("invitations") : asksName ? () => setStep("name") : undefined}
            submit={async () => {
              const { data } = await api().POST("/organizations", { body: { name: organization.trim() } });
              if (!data) return "Couldn't create your organization. Try again.";
              await navigate({ to: "/dashboard/$organizationId", params: { organizationId: data.id } });
            }}
          />
        )}
      </div>
      {/* The gate sends anyone without an org back here, so this is the only way out of the wrong account. */}
      <p className="text-sm text-muted-foreground">
        Signed in as {session.user.email} ·{" "}
        <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={signOut}>
          Sign out
        </button>
      </p>
    </main>
  );
}

function Progress({ progress }: { progress: [step: number, of: number] }) {
  return (
    <div className="flex justify-center gap-1.5">
      <span className="sr-only">
        Step {progress[0]} of {progress[1]}
      </span>
      {Array.from({ length: progress[1] }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1.5 rounded-full transition-all ${i + 1 === progress[0] ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30"}`}
        />
      ))}
    </div>
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  // Stays set after success too, so a second click while moving on can't join twice.
  const [joining, setJoining] = useState<string>();

  const join = async (id: string) => {
    setJoining(id);
    setError(undefined);
    const { data } = await api().POST("/invitations/{id}/accept", { params: { path: { id } } });
    await queryClient.invalidateQueries({ queryKey: ["invitations"] });
    if (!data) {
      setError("That invitation is no longer open.");
      setJoining(undefined);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    await navigate({ to: "/dashboard/$organizationId", params: { organizationId: data.organization_id } });
  };

  return (
    <div className="flex w-full max-w-sm animate-in flex-col gap-6 text-center duration-200 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      {progress && <Progress progress={progress} />}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">{greeting}</p>
        <h1 className="text-2xl font-semibold">You've been invited</h1>
        <p className="text-sm text-balance text-muted-foreground">Join to run events together with your team.</p>
      </div>
      <ItemGroup>
        {invitations.map((invitation) => (
          <Item key={invitation.id} variant="outline" className="text-left">
            <ItemContent>
              <ItemTitle>{invitation.organization.name}</ItemTitle>
              <ItemDescription>Invited by {invitation.invited_by.name || "a member"}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button disabled={joining !== undefined} onClick={() => join(invitation.id)}>
                Join
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" disabled={joining !== undefined} onClick={createOwn}>
          Create my own organization instead
        </Button>
        {back && (
          <Button variant="ghost" disabled={joining !== undefined} onClick={back}>
            Back
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// One question, centered, with the keyboard up. `submit` returns an error message, or nothing once
// it has moved on.
function Step({
  greeting,
  question,
  hint,
  placeholder,
  autoComplete,
  value,
  onChange,
  progress,
  back,
  submit,
}: {
  greeting?: string;
  question: string;
  hint: string;
  placeholder?: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  progress?: [step: number, of: number];
  back?: () => void;
  submit: () => Promise<string | void>;
}) {
  const id = useId();
  const [error, setError] = useState<string>();
  // Stays set after success too, so a second click while moving on can't submit twice.
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex w-full max-w-sm animate-in flex-col gap-6 text-center duration-200 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const error = await submit();
        if (error) {
          setError(error);
          setSubmitting(false);
        }
      }}
    >
      {progress && <Progress progress={progress} />}
      <div className="flex flex-col gap-2">
        {greeting && <p className="text-muted-foreground">{greeting}</p>}
        <h1 id={id} className="text-2xl font-semibold">
          {question}
        </h1>
        <p className="text-sm text-balance text-muted-foreground">{hint}</p>
      </div>
      <Input
        aria-labelledby={id}
        autoFocus
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        maxLength={100}
        className="h-12 text-center text-lg md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={submitting || !value.trim()}>
          Continue
        </Button>
        {back && (
          <Button type="button" variant="ghost" disabled={submitting} onClick={back}>
            Back
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
