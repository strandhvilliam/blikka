import { IconCalendarEvent, IconLink, IconPlus, IconSearch } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input, InputGroup } from "@ui-sdk/react/input";
import { Button } from "@ui-sdk/react/button";
import { isApiError } from "@/api/client.ts";
import { type Competition, competitionsQuery, createCompetitionMutation } from "@/api/competitions.ts";
import { Card } from "@/components/Card.tsx";
import { EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { statusDots } from "@/components/StatusBadge.tsx";
import { type CompetitionStatus, byStatus, competitionStatus } from "@/lib/competitionStatus.ts";
import { slugOf } from "@/lib/slug.ts";
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

  // byStatus puts the most recently closed first, so the years come out newest first. Ended means closes_at is set.
  const endedByYear = Map.groupBy(
    shown.filter((c) => c.status === "Ended"),
    (c) => new Intl.DateTimeFormat("en", { year: "numeric", timeZone: c.time_zone }).format(new Date(c.closes_at!)),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <PageHeader title="Events" description={`Competitions, photo walks and exhibitions run by ${organization.name}.`}>
        {/* Cosmetic: the Api refuses the create without this permission either way. */}
        {organization.permissions.includes("competitions:write") && <NewEvent organizationId={organization.id} />}
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

// The name links to the event, and its ::after stretches over the closest positioned parent so the whole card is the target.
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

// shortcut: a made-up count that stays the same per event, until the Api reports entries per event.
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
          {/* Drafts already say "Not published" below, so their dot stands alone for sighted readers. */}
          <span className={competition.status === "Draft" ? "sr-only" : ""}>{competition.status}</span>
        </span>
      </div>
      <p className="mt-auto text-sm text-muted-foreground">
        {/* A draft can't have entrants (unpublishing is refused once someone has entered). */}
        {competition.status === "Draft" ? (
          "Not published"
        ) : (
          <>
            <span className="font-mono text-foreground">{sampleEntries(competition.id)}</span> entries
          </>
        )}
        {" · "}
        {/* Mono only for a date, not for "No date yet". */}
        <span className={competition.opens_at || competition.closes_at ? "font-mono text-xs" : ""}>
          {formatWindow(competition.opens_at, competition.closes_at, competition.time_zone)}
        </span>
      </p>
    </Card>
  );
}

function NewEvent({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const create = useMutation(createCompetitionMutation(organizationId));
  const [name, setName] = useState("");
  // isSuccess too, so a second click while moving on can't create twice.
  const submitting = create.isPending || create.isSuccess;

  const error =
    create.error &&
    (isApiError(create.error, "CompetitionNameTaken")
      ? "That name is taken."
      : "Couldn't create the event. Try again.");

  return (
    <Dialog>
      <DialogTrigger data-variant="solid" className="rounded-full ps-3 pe-3.5">
        <IconPlus aria-hidden />
        New event
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>New event</DialogTitle>
        <DialogDescription>A competition, photo walk or exhibition.</DialogDescription>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name.trim(), {
              onSuccess: (competition) =>
                navigate({
                  to: "/dashboard/$organizationId/events/$competitionId",
                  params: { organizationId, competitionId: competition.id },
                }),
            });
          }}
        >
          <Field invalid={error ? true : undefined}>
            <FieldLabel>Name</FieldLabel>
            <Input
              autoFocus
              autoComplete="off"
              placeholder="Summer Photo Walk"
              required
              maxLength={100}
              value={name}
              onValueChange={(value) => {
                setName(value);

                if (create.isError) {
                  create.reset();
                }
              }}
            />
            {error && <FieldError>{error}</FieldError>}
            {/* min-w-0 lets a long slug truncate instead of widening the dialog. */}
            {name.trim() && (
              <FieldDescription className="flex min-w-0 items-center gap-1.5">
                <IconLink aria-hidden />
                <span className="sr-only">Link name:</span>
                <span className="truncate">{slugOf(name)}</span>
              </FieldDescription>
            )}
          </Field>
          <Button type="submit" data-variant="solid" className="self-end" disabled={submitting || !name.trim()}>
            Create event
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
