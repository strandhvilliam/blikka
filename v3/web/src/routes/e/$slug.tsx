import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/api/authClient.ts";
import { isApiError } from "@/api/client.ts";
import { enterMutation, entryCompetitionQuery, myEntryQuery } from "@/api/entry.ts";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { Separator } from "@ui-sdk/react/separator";
import { formatIn } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/e/$slug")({
  loader: async ({ context, params }) => {
    const competition = await context.queryClient.ensureQueryData(entryCompetitionQuery(params.slug));

    if (!competition) {
      throw notFound();
    }

    return competition;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.name} · Blikka` : "Blikka" }] }),
  component: EventPage,
});

type Competition = ReturnType<typeof Route.useLoaderData>;

const isClosed = (competition: Competition) =>
  competition.closes_at !== null && new Date(competition.closes_at) <= new Date();

const when = (competition: Competition) => {
  const at = (iso: string) => formatIn(new Date(iso), competition.time_zone);

  if (isClosed(competition)) {
    return "Entries are closed.";
  }

  if (competition.opens_at && new Date(competition.opens_at) > new Date()) {
    return `Photos from ${at(competition.opens_at)}.`;
  }

  if (competition.closes_at) {
    return `Photos until ${at(competition.closes_at)}.`;
  }

  return null;
};

function EventPage() {
  const competition = Route.useLoaderData();

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-balance">{competition.name}</h1>
          {competition.description && (
            <p className="whitespace-pre-line text-muted-foreground">{competition.description}</p>
          )}
          <p className="text-sm text-muted-foreground">{when(competition)}</p>
        </div>
        <Entry competition={competition} />
      </div>
    </main>
  );
}

// A guest's token lives in this browser (adr/0004), so the entry is only looked up once mounted.
function Entry({ competition }: { competition: Competition }) {
  const { data: participant } = useQuery(myEntryQuery(competition.id));

  if (participant === undefined) {
    return null;
  }

  if (participant) {
    return <YourEntry participant={participant} />;
  }

  if (isClosed(competition)) {
    return null;
  }

  return <EnterForm competition={competition} />;
}

function YourEntry({ participant }: { participant: { name: string; email: string } }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium">You're entered</p>
      <p className="text-sm text-muted-foreground wrap-anywhere">{participant.name || participant.email}</p>
      <p className="text-sm text-muted-foreground">Your topics will show up here when submissions open.</p>
    </div>
  );
}

const enterError = (error: Error, signedIn: boolean) => {
  if (isApiError(error, "EntryClosed")) {
    return "Entries have closed.";
  }

  // Signing in with that email claims the guest entry (adr/0004).
  if (isApiError(error, "AlreadyEntered") && !signedIn) {
    return "That email has already entered. Continue with Google using it to get your entry back.";
  }

  if (isApiError(error, "AlreadyEntered")) {
    return "Your email has already entered this event. Ask the organizer for help.";
  }

  return "Couldn't enter. Try again.";
};

function EnterForm({ competition }: { competition: Competition }) {
  const { session } = Route.useRouteContext();
  const enter = useMutation(enterMutation(competition.id));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const submit = (guest: { name: string; email: string } | null) => enter.mutate(guest);
  const error = enter.error && enterError(enter.error, !!session);

  return (
    <div className="flex flex-col gap-6">
      {session ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground wrap-anywhere">
            Signed in as {session.user.name || session.user.email}
          </p>
          <Button data-variant="solid" disabled={enter.isPending} onClick={() => submit(null)}>
            Enter
          </Button>
        </div>
      ) : (
        <>
          <Button onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.href })}>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Separator className="flex-1" />
            or enter as a guest
            <Separator className="flex-1" />
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit({ name: name.trim(), email: email.trim() });
            }}
            onChange={() => enter.isError && enter.reset()}
          >
            <Input
              aria-label="Name"
              placeholder="Your name"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onValueChange={setName}
            />
            <Input
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onValueChange={setEmail}
            />
            <Button type="submit" data-variant="solid" disabled={enter.isPending || !name.trim() || !email.trim()}>
              Enter as a guest
            </Button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
