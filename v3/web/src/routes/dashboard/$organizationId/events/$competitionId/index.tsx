import { IconChevronRight, IconCircle, IconCircleCheckFilled, IconUsers } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { type ComponentProps, type ReactNode, useEffect, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import type { Competition } from "@/api/competitions.ts";
import { type Participant, participantsQuery } from "@/api/participants.ts";
import { type Topic, topicsQuery } from "@/api/topics.ts";
import { Card } from "@/components/Card.tsx";
import { Count, EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { formatIn, formatWindow } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(participantsQuery(params.competitionId)),
      context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
    ]),
  component: Event,
});

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

function Event() {
  const { competition } = Route.useRouteContext();
  const { data: participants } = useSuspenseQuery(participantsQuery(competition.id));
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <span className="font-mono text-xs">
            {formatWindow(competition.opens_at, competition.closes_at, competition.time_zone)} ·{" "}
            {competition.time_zone.replaceAll("_", " ")}
          </span>
        }
      />
      {/* A draft can't have entrants (unpublishing is refused once someone has entered), so it only gets the checklist. */}
      {competition.published_at ? (
        <Published competition={competition} participants={participants} topics={topics} />
      ) : (
        <Checklist competition={competition} topics={topics.length} />
      )}
    </>
  );
}

function Published({
  competition,
  participants,
  topics,
}: {
  competition: Competition;
  participants: Participant[];
  topics: Topic[];
}) {
  const params = { organizationId: competition.organization_id, competitionId: competition.id };
  const toParticipants = <Link to="/dashboard/$organizationId/events/$competitionId/participants" params={params} />;

  return (
    <>
      <EntryCard competition={competition} />
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Entries" link={toParticipants} className="lg:col-span-2">
          <Entries competition={competition} participants={participants} />
        </Panel>
        <Panel title="Latest entries" link={toParticipants}>
          <Latest participants={participants} timeZone={competition.time_zone} />
        </Panel>
      </div>
      <Panel
        title="Submissions by topic"
        link={<Link to="/dashboard/$organizationId/events/$competitionId/topics" params={params} />}
      >
        <ByTopic topics={topics} participants={participants.length} />
      </Panel>
    </>
  );
}

// A card whose title row leads to the page behind it.
function Panel({
  title,
  link,
  className = "",
  children,
}: {
  title: string;
  link: ComponentProps<typeof Button>["render"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`flex flex-col overflow-hidden ${className}`}>
      <div className="flex h-12 items-center gap-2 border-b border-border px-5">
        <h2 className="font-semibold">{title}</h2>
        <Button
          aria-label={`Open ${title.toLowerCase()}`}
          className="ms-auto size-7 border-transparent bg-transparent p-0 text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
          render={link}
        >
          <IconChevronRight aria-hidden />
        </Button>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

function windowState(competition: Competition, now: Date) {
  const opens = competition.opens_at ? new Date(competition.opens_at) : null;
  const closes = competition.closes_at ? new Date(competition.closes_at) : null;

  if (closes && closes <= now) {
    return { word: "Closed", dot: "bg-muted-foreground", detail: `Closed ${ago(competition.closes_at!)}` };
  }

  if (!opens || opens > now) {
    return {
      word: "Not open",
      dot: "bg-blue-hour",
      detail: opens ? `Opens ${ago(competition.opens_at!)}` : "No opening time set",
    };
  }

  return {
    word: "Open",
    dot: "bg-safelight",
    detail: closes ? `Closes ${ago(competition.closes_at!)}` : "No deadline",
  };
}

function EntryCard({ competition }: { competition: Competition }) {
  const params = { organizationId: competition.organization_id, competitionId: competition.id };
  const path = `/e/${competition.slug}`;
  // The origin is filled in after mount, so the server and browser render the same.
  const [origin, setOrigin] = useState("");
  // oxlint-disable-next-line react/set-state-in-effect -- set after hydration on purpose, see above
  useEffect(() => setOrigin(window.location.origin), []);
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const state = windowState(competition, new Date());
  const at = (iso: string | null) => (iso ? formatIn(new Date(iso), competition.time_zone) : "Not set");

  return (
    <Card className="overflow-hidden">
      <div className="flex h-12 items-center border-b border-border px-5">
        <h2 className="font-semibold">Entry page</h2>
      </div>
      <div className="flex flex-col gap-6 p-5 sm:flex-row">
        {/* Black on white in both themes, so phones read it off any screen. */}
        <div className="grid size-36 shrink-0 place-items-center rounded-[10px] border border-border bg-white p-2 max-sm:hidden">
          {origin && <QRCodeSVG value={origin + path} size={124} marginSize={0} title="Entry page QR code" />}
        </div>
        <dl className="grid flex-1 grid-cols-1 content-start gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Detail label="Link" className="sm:col-span-2">
            <a href={path} target="_blank" rel="noreferrer" className="font-mono text-sm wrap-anywhere">
              {origin.replace(/^https?:\/\//, "")}
              {path}
            </a>
          </Detail>
          <Detail label="Published">
            <span className="font-mono text-xs">{at(competition.published_at)}</span>
          </Detail>
          <Detail label="Time zone">{competition.time_zone.replaceAll("_", " ")}</Detail>
          <Detail label="Opens">
            <span className="font-mono text-xs">{at(competition.opens_at)}</span>
          </Detail>
          <Detail label="Closes">
            <span className="font-mono text-xs">{at(competition.closes_at)}</span>
          </Detail>
        </dl>
      </div>
      <div className="flex min-h-12 items-center gap-3 border-t border-border bg-page px-5 py-2 text-sm">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${state.dot}`} />
        <span className="font-medium">{state.word}</span>
        <span className="text-muted-foreground">{state.detail}</span>
        <Button
          className="ms-auto no-underline"
          render={<Link to="/dashboard/$organizationId/events/$competitionId/settings" params={params} />}
        >
          Manage
        </Button>
      </div>
    </Card>
  );
}

function Detail({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const DAYS = 14;

// "2026-11-12", the day a moment falls on in the event's time zone.
const dayKey = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(key));

// The last DAYS days up to today, or up to the closing day once closed.
const lastDays = (competition: Competition, now: Date) => {
  const closes = competition.closes_at ? new Date(competition.closes_at) : null;
  const end = new Date(dayKey(closes && closes < now ? closes : now, competition.time_zone));

  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (DAYS - 1 - i));

    return day.toISOString().slice(0, 10);
  });
};

function Entries({ competition, participants }: { competition: Competition; participants: Participant[] }) {
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const days = lastDays(competition, new Date());
  const perDay = new Map(days.map((day) => [day, 0]));

  for (const participant of participants) {
    const day = dayKey(new Date(participant.created_at), competition.time_zone);
    const count = perDay.get(day);

    if (count !== undefined) {
      perDay.set(day, count + 1);
    }
  }

  const counts = days.map((day) => ({ day, count: perDay.get(day) ?? 0 }));
  const most = Math.max(1, ...counts.map((c) => c.count));
  const inRange = counts.reduce((sum, c) => sum + c.count, 0);
  const guests = participants.filter((participant) => !participant.signed_in).length;

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="font-mono text-3xl font-medium tracking-tight">{participants.length}</span>
          <span className="text-sm text-muted-foreground">participants</span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-base">{participants.length - guests}</span>
          <span className="text-sm text-muted-foreground">with an account</span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-base">{guests}</span>
          <span className="text-sm text-muted-foreground">guests</span>
        </div>
      </div>
      <figure className="flex flex-1 flex-col gap-2">
        <figcaption className="text-xs text-muted-foreground">
          Entries per day, last {DAYS} days <span className="font-mono">({inRange})</span>
        </figcaption>
        <div
          role="img"
          aria-label={`Entries per day: ${counts.map((c) => `${dayLabel(c.day)} ${c.count}`).join(", ")}`}
          className="flex min-h-24 flex-1 items-end gap-0.5 border-b border-border"
        >
          {counts.map(({ day, count }) => (
            <div key={day} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-6 rounded-t-[4px] ${count ? "bg-foreground/80 group-hover:bg-foreground" : ""}`}
                style={{ height: `${(count / most) * 100}%` }}
              />
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-foreground px-2 py-1 font-mono text-[0.6875rem] whitespace-nowrap text-background group-hover:block">
                {dayLabel(day)} · {count}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[0.6875rem] text-muted-foreground">
          <span>{dayLabel(days[0]!)}</span>
          <span>{dayLabel(days[DAYS - 1]!)}</span>
        </div>
      </figure>
    </div>
  );
}

// "12m", "3h", "5d", then the date: a list of times reads at a glance when they're all short.
const shortAgo = (iso: string, now: Date, timeZone: string) => {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);

  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m`;
  }

  if (minutes < 24 * 60) {
    return `${Math.floor(minutes / 60)}h`;
  }

  if (minutes < 7 * 24 * 60) {
    return `${Math.floor(minutes / (24 * 60))}d`;
  }

  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
};

function Latest({ participants, timeZone }: { participants: Participant[]; timeZone: string }) {
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const now = new Date();
  const latest = participants.toSorted((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  if (latest.length === 0) {
    return <EmptyState icon={IconUsers} title="No one yet" description="Share the entry page to get people in." />;
  }

  return (
    <ul className="divide-y divide-border">
      {latest.map((participant) => (
        <li key={participant.id} className="flex items-center gap-3 px-5 py-2.5">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground uppercase"
          >
            {(participant.name || participant.email).trim().charAt(0)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{participant.name || participant.email}</span>
            <span className="text-xs text-muted-foreground">{participant.signed_in ? "Account" : "Guest"}</span>
          </div>
          <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
            {shortAgo(participant.created_at, now, timeZone)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ByTopic({ topics, participants }: { topics: Topic[]; participants: number }) {
  return (
    <ol className="grid gap-x-10 gap-y-4 p-5 lg:grid-cols-2">
      {topics.map((topic, index) => {
        const done = topic.submissions;

        return (
          <li key={topic.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-3 text-sm">
              {/* A frame number, like the roll's 04/08. */}
              <span className="w-5 shrink-0 text-end font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {done}/{participants}
              </span>
            </div>
            <div className="ms-8 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/80"
                style={{ width: `${participants ? (done / participants) * 100 : 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Checklist({ competition, topics }: { competition: Competition; topics: number }) {
  const params = { organizationId: competition.organization_id, competitionId: competition.id };
  const settings = <Link to="/dashboard/$organizationId/events/$competitionId/settings" params={params} />;

  const steps = [
    {
      done: topics > 0,
      title: "Add topics",
      description: "What participants photograph. One is enough for a single theme.",
      // Into the setup, which carries on through the questions after it.
      action: "Add topics",
      link: (
        <Link
          to="/dashboard/$organizationId/events/$competitionId/setup/$step"
          params={{ ...params, step: "topics" }}
        />
      ),
    },
    {
      done: competition.opens_at !== null,
      title: "Set when submissions open",
      description: "Or open them by hand when the event starts.",
      action: "Set times",
      link: (
        <Link
          to="/dashboard/$organizationId/events/$competitionId/setup/$step"
          params={{ ...params, step: "window" }}
        />
      ),
    },
    {
      done: false,
      title: "Publish",
      description: "Participants can enter once it's published.",
      action: "Settings",
      link: settings,
    },
  ];

  return (
    <Card className="max-w-3xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Get it ready</h2>
          <Count>
            {steps.filter((step) => step.done).length}/{steps.length}
          </Count>
        </div>
        <p className="text-sm text-muted-foreground">This event is a draft. Only your organization can see it.</p>
      </div>
      <ol className="border-t border-border">
        {steps.map((step) => (
          <li key={step.title} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0">
            {step.done ? (
              <IconCircleCheckFilled aria-hidden className="size-5 shrink-0 text-leaf" />
            ) : (
              <IconCircle aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className={`font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                {step.title}
                {step.done && <span className="sr-only"> (done)</span>}
              </span>
              <span className="text-sm text-muted-foreground">{step.description}</span>
            </div>
            {!step.done && (
              <Button className="no-underline" render={step.link}>
                {step.action}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
