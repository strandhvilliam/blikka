import { IconLink, IconPlus } from "@tabler/icons-react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { api } from "../../../api.ts";
import { Button } from "../../../components/ui/Button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/Dialog.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../../components/ui/Empty.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Item, ItemContent, ItemGroup, ItemTitle } from "../../../components/ui/Item.tsx";
import { Label } from "../../../components/ui/Label.tsx";
import { competitionsQuery } from "../../../competitions.ts";
import { slugOf } from "../../../slug.ts";

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
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>Competitions, photo walks and exhibitions you create show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {competitions.map((competition) => (
            <Item
              key={competition.id}
              variant="outline"
              render={
                <Link
                  to="/dashboard/$organizationId/events/$competitionId"
                  params={{ organizationId: organization.id, competitionId: competition.id }}
                />
              }
            >
              <ItemContent>
                <ItemTitle>{competition.name}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </main>
  );
}

function NewEvent({ organizationId }: { organizationId: string }) {
  const id = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  // Stays set after success too, so a second click while moving on can't create twice.
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <IconPlus />
        New event
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            const { data, response } = await api().POST("/competitions", {
              body: { organization_id: organizationId, name: name.trim() },
            });
            if (!data) {
              setError(response.status === 409 ? "That name is taken." : "Couldn't create the event. Try again.");
              setSubmitting(false);
              return;
            }
            await queryClient.invalidateQueries({ queryKey: ["competitions"] });
            await navigate({
              to: "/dashboard/$organizationId/events/$competitionId",
              params: { organizationId, competitionId: data.id },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>A competition, photo walk or exhibition.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>Name</Label>
            <Input
              id={id}
              autoFocus
              autoComplete="off"
              placeholder="Summer Photo Walk"
              required
              maxLength={100}
              aria-describedby={name.trim() ? `${id}-slug` : undefined}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          {/* One row at every width; min-w-0 lets a long slug truncate instead of widening the dialog. */}
          <DialogFooter className="min-w-0 flex-row items-center">
            {name.trim() && (
              <p id={`${id}-slug`} className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <IconLink className="size-4 shrink-0" />
                <span className="sr-only">Link name:</span>
                <span className="truncate">{slugOf(name)}</span>
              </p>
            )}
            <Button type="submit" className="ml-auto" disabled={submitting || !name.trim()}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
