import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/api/authClient.ts";
import { isApiError } from "@/api/client.ts";
import {
  enterMutation,
  entryCompetitionQuery,
  entryTopicsQuery,
  myEntryQuery,
  rememberedGuest,
  submitMutation,
} from "@/api/entry.ts";
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
    return <YourEntry competition={competition} participant={participant} />;
  }

  if (isClosed(competition)) {
    return null;
  }

  return <EnterForm competition={competition} />;
}

function YourEntry({
  competition,
  participant,
}: {
  competition: Competition;
  participant: { id: string; name: string; email: string };
}) {
  const { data: topics } = useQuery(entryTopicsQuery(competition.id, participant.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="font-medium">You're entered</p>
        <p className="text-sm text-muted-foreground wrap-anywhere">{participant.name || participant.email}</p>
      </div>
      {topics && <Topics competition={competition} participantId={participant.id} topics={topics} />}
    </div>
  );
}

type Topic = { id: string; position: number; name: string | null; status: "done" | "open" | "locked" | "missed" };

const progress = (competition: Competition, topics: Array<Topic>) => {
  const done = topics.filter((topic) => topic.status === "done").length;

  if (isClosed(competition)) {
    return `Submissions are closed. You did ${done} of ${topics.length}.`;
  }

  if (topics.every((topic) => topic.status === "locked")) {
    return `Your ${topics.length === 1 ? "topic shows" : `${topics.length} topics show`} up here when submissions open.`;
  }

  if (done === topics.length) {
    return "All done. You can replace a topic until submissions close.";
  }

  return `${done} of ${topics.length} done`;
};

// A locked topic's title already says so.
const statusLabel = { done: "Done", open: "Open", locked: null, missed: "Missed" };

function Topics({
  competition,
  participantId,
  topics,
}: {
  competition: Competition;
  participantId: string;
  topics: Array<Topic>;
}) {
  const submit = useMutation(submitMutation(competition.id, participantId));

  const error =
    submit.error &&
    (isApiError(submit.error, "TopicNotOpen") ? "That topic isn't open anymore." : "Couldn't save. Try again.");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{progress(competition, topics)}</p>
      <ul className="flex flex-col divide-y divide-border border-y border-border text-left">
        {topics.map((topic) => (
          <li key={topic.id} className="flex items-center gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm text-muted-foreground">
                Topic {topic.position} of {topics.length}
              </span>
              <span className="font-medium wrap-anywhere">{topic.name ?? "Locked"}</span>
            </div>
            {/* shortcut: a button stands in for the upload until uploads ship (.local/plans/competition-slices.md). */}
            {topic.status === "open" || (topic.status === "done" && !isClosed(competition)) ? (
              <Button
                data-variant={topic.status === "open" ? "solid" : undefined}
                disabled={submit.isPending}
                onClick={() => submit.mutate(topic.id)}
              >
                {topic.status === "open" ? "Mark done" : "Replace"}
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">{statusLabel[topic.status]}</span>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
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
  // The form only renders once mounted (Entry), so reading the browser's storage here is safe.
  const [name, setName] = useState(() => rememberedGuest().name);
  const [email, setEmail] = useState(() => rememberedGuest().email);
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
