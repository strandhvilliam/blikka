import { IconCalendarEvent, IconPlus, IconSearch } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Input, InputGroup } from "@ui-sdk/react/input";
import { Button } from "@ui-sdk/react/button";
import { type Competition, competitionsQuery } from "@/api/competitions.ts";
import { Card } from "@/components/Card.tsx";
import { EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { statusDots } from "@/components/StatusBadge.tsx";
import { type CompetitionStatus, byStatus, competitionStatus } from "@/lib/competitionStatus.ts";
import { formatWindow } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(competitionsQuery(params.organizationId)),
  component: Dashboard,
});

const filters = [
  { value: "All", label: "All" },
  { value: "Upcoming", label: "Upcoming" },
  { value: "Draft", label: "Drafts" },
  { value: "Ended", label: "Ended" },
] as const;

type Filter = (typeof filters)[number]["value"];

function Dashboard() {
  const { organization } = Route.useRouteContext();
  const { data: competitions } = useSuspenseQuery(competitionsQuery(organization.id));
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  const sorted = byStatus(competitions).map((c) => ({ ...c, status: competitionStatus(c) }));
  const count = (value: Filter) => (value === "All" ? sorted.length : sorted.filter((c) => c.status === value).length);
  const query = search.trim().toLocaleLowerCase();

  const shown = sorted.filter(
    (c) => (filter === "All" || c.status === filter) && c.name.toLocaleLowerCase().includes(query),
  );

  const current = shown.filter((c) => c.status !== "Ended");

  const endedByYear = Map.groupBy(
    shown.filter((c) => c.status === "Ended"),
    (c) => new Intl.DateTimeFormat("en", { year: "numeric", timeZone: c.time_zone }).format(new Date(c.closes_at!)),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <PageHeader title="Events" description={`Competitions, photo walks and exhibitions run by ${organization.name}.`}>
        {organization.permissions.includes("competitions:write") && (
          <Button
            data-variant="solid"
            className="rounded-full ps-3 pe-3.5 no-underline"
            render={<Link to="/dashboard/$organizationId/events/new" params={{ organizationId: organization.id }} />}
          >
            <IconPlus aria-hidden />
            New event
          </Button>
        )}
      </PageHeader>

      {competitions.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconCalendarEvent}
            title="No events yet"
            description="Competitions, photo walks and exhibitions you create show up here."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <InputGroup className="relative min-w-0 flex-1 basis-60">
              <IconSearch
                aria-hidden
                className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="ps-8"
                type="search"
                aria-label="Find an event"
                placeholder="Find an event"
                value={search}
                onValueChange={setSearch}
              />
            </InputGroup>
            <SegmentedControl
              aria-label="Show"
              value={filter}
              onValueChange={(value) => setFilter(filters.find((f) => f.value === value)?.value ?? "All")}
            >
              <SegmentedControlIndicator />
              {filters.map(({ value, label }) => (
                <SegmentedControlItem key={value} value={value} className="gap-1.5">
                  {label}
                  <span className="font-mono text-[0.6875rem]">{count(value)}</span>
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>

          {shown.length === 0 && (
            <Card>
              <EmptyState
                icon={IconSearch}
                title="No events match"
                description="Try another name, or show all events."
              />
            </Card>
          )}

          {current.length > 0 && (
            <section className="@container flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                Current
                <span className="rounded-[6px] bg-muted px-1.5 py-px text-[0.6875rem] font-normal text-muted-foreground">
                  Sample data
                </span>
              </h2>
              <ul className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
                {current.map((competition) => (
                  <li key={competition.id}>
                    <EventCard competition={competition} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {[...endedByYear].map(([year, ended]) => (
            <section key={year} className="flex flex-col gap-3">
              <h2 className="font-mono text-sm font-medium text-muted-foreground">{year}</h2>
              <Card className="overflow-hidden">
                <ul>
                  {ended.map((competition) => (
                    <li
                      key={competition.id}
                      className={`relative flex h-11 items-center gap-4 border-b border-border px-4 text-sm last:border-0 hover:bg-muted/40 ${focusRing}`}
                    >
                      <EventLink competition={competition} className="min-w-0 flex-1 truncate" />
                      <span className="text-muted-foreground max-sm:hidden">
                        <span className="font-mono">{sampleEntries(competition.id)}</span> entries
                      </span>
                      <span className="w-44 text-end font-mono text-xs text-muted-foreground max-sm:w-auto">
                        {formatWindow(competition.opens_at, competition.closes_at, competition.time_zone)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

const focusRing =
  "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring";

function EventLink({ competition, className = "" }: { competition: Competition; className?: string }) {
  return (
    <Link
      to="/dashboard/$organizationId/events/$competitionId"
      params={{ organizationId: competition.organization_id, competitionId: competition.id }}
      className={`no-underline outline-none after:absolute after:inset-0 ${className}`}
    >
      {competition.name}
    </Link>
  );
}

const sampleEntries = (id: string) => [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7) % 240;

function EventCard({ competition }: { competition: Competition & { status: CompetitionStatus } }) {
  return (
    <Card className={`relative flex h-full flex-col gap-3 p-4 hover:bg-muted/40 ${focusRing}`}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <EventLink competition={competition} className="truncate font-medium" />
          {competition.published_at && (
            <span className="truncate text-sm text-muted-foreground">/e/{competition.slug}</span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium">
          <span aria-hidden className={`size-2 rounded-full ${statusDots[competition.status]}`} />
          <span className={competition.status === "Draft" ? "sr-only" : ""}>{competition.status}</span>
        </span>
      </div>
      <p className="mt-auto text-sm text-muted-foreground">
        {competition.status === "Draft" ? (
          "Not published"
        ) : (
          <>
            <span className="font-mono text-foreground">{sampleEntries(competition.id)}</span> entries
          </>
        )}
        {" · "}
        <span className={competition.opens_at || competition.closes_at ? "font-mono text-xs" : ""}>
          {formatWindow(competition.opens_at, competition.closes_at, competition.time_zone)}
        </span>
      </p>
    </Card>
  );
}
