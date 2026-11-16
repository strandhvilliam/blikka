import { IconLink, IconPlus } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Button } from "@ui-sdk/react/button";
import { isApiError } from "@/api/client.ts";
import { competitionsQuery, createCompetitionMutation } from "@/api/competitions.ts";
import { slugOf } from "@/lib/slug.ts";

export const Route = createFileRoute("/dashboard/$organizationId/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(competitionsQuery(params.organizationId)),
  component: Dashboard,
});

function Dashboard() {
  const { organization } = Route.useRouteContext();
  const { data: competitions } = useSuspenseQuery(competitionsQuery(organization.id));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Events</h1>
        {/* Cosmetic: the Api refuses the create without this permission either way. */}
        {organization.permissions.includes("competitions:write") && <NewEvent organizationId={organization.id} />}
      </div>
      {competitions.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-16 text-center">
          <p className="font-medium">No events yet</p>
          <p className="text-sm text-muted-foreground">
            Competitions, photo walks and exhibitions you create show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {competitions.map((competition) => (
            <li key={competition.id}>
              <Link
                to="/dashboard/$organizationId/events/$competitionId"
                params={{ organizationId: organization.id, competitionId: competition.id }}
                className="flex py-3 font-medium"
              >
                {competition.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
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
      <DialogTrigger data-variant="solid">
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
