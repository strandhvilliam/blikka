import { IconArrowRight, IconChevronRight, IconLink, IconPlus, IconSearch } from "@tabler/icons-react";
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
import { PageHeader } from "@/components/PageHeader.tsx";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { byStatus, competitionStatus } from "@/lib/competitionStatus.ts";
import { slugOf } from "@/lib/slug.ts";
import { formatIn, formatWindow } from "@/lib/timeZone.ts";

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
  const live = sorted.filter((c) => c.status === "Live");
  const count = (value: Filter) => (value === "All" ? sorted.length : sorted.filter((c) => c.status === value).length);
  const query = search.trim().toLocaleLowerCase();

  const shown = sorted.filter(
    (c) => (filter === "All" || c.status === filter) && c.name.toLocaleLowerCase().includes(query),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <PageHeader title="Events" description={`Competitions, photo walks and exhibitions run by ${organization.name}.`}>
        {/* Cosmetic: the Api refuses the create without this permission either way. */}
        {organization.permissions.includes("competitions:write") && <NewEvent organizationId={organization.id} />}
      </PageHeader>

      {competitions.length === 0 ? (
        <Card className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="font-medium">No events yet</p>
          <p className="text-sm text-muted-foreground">
            Competitions, photo walks and exhibitions you create show up here.
          </p>
        </Card>
      ) : (
        <>
          {live.map((competition) => (
            <LiveCard key={competition.id} competition={competition} />
          ))}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <SegmentedControl
                aria-label="Show"
                value={filter}
                onValueChange={(value) => setFilter(filters.find((f) => f.value === value)?.value ?? "All")}
                className="me-auto"
              >
                <SegmentedControlIndicator />
                {filters.map(({ value, label }) => (
                  <SegmentedControlItem key={value} value={value} className="gap-1.5">
                    {label}
                    <span className="font-mono text-[0.6875rem]">{count(value)}</span>
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
              <InputGroup className="relative w-full sm:w-60">
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
            </div>

            <table className="w-full text-sm">
              <thead className="border-y border-border bg-background text-xs text-muted-foreground">
                <tr>
                  <th className="h-8 px-4 text-start font-medium">Name</th>
                  <th className="w-32 px-3 text-start font-medium">Status</th>
                  <th className="w-64 px-3 text-start font-medium max-md:hidden">When</th>
                  <th className="w-12" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {shown.map((competition) => (
                  <tr
                    key={competition.id}
                    className="relative border-b border-border last:border-0 hover:bg-muted/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring"
                  >
                    <td className="h-11 px-4">
                      <Link
                        to="/dashboard/$organizationId/events/$competitionId"
                        params={{ organizationId: organization.id, competitionId: competition.id }}
                        className="font-medium wrap-anywhere no-underline outline-none after:absolute after:inset-0"
                      >
                        {competition.name}
                      </Link>
                    </td>
                    <td className="px-3">
                      <StatusBadge status={competition.status} />
                    </td>
                    <td className="px-3 font-mono text-xs text-muted-foreground uppercase max-md:hidden">
                      {formatWindow(competition.opens_at, competition.closes_at, competition.time_zone)}
                    </td>
                    <td className="pe-4 text-end">
                      <IconChevronRight aria-hidden className="ms-auto size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No events match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </main>
  );
}

function LiveCard({ competition }: { competition: Competition }) {
  const params = { organizationId: competition.organization_id, competitionId: competition.id };

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-medium">
          <span aria-hidden className="size-[7px] rounded-full bg-safelight" />
          Live now
        </span>
        <h2 className="text-base font-semibold wrap-anywhere">{competition.name}</h2>
        <p className="text-sm text-muted-foreground">
          {competition.closes_at
            ? `Closes ${formatIn(new Date(competition.closes_at), competition.time_zone)}.`
            : "Open, with no deadline."}
        </p>
      </div>
      <Button
        className="no-underline"
        render={<Link to="/dashboard/$organizationId/events/$competitionId" params={params} />}
      >
        Open
        <IconArrowRight aria-hidden />
      </Button>
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
