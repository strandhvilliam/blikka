import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { ApiError } from "@/api/client.ts";
import {
  type CompetitionUpdate,
  deleteCompetitionMutation,
  updateCompetitionMutation,
} from "@/api/competitions.ts";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Label } from "@/components/ui/Label.tsx";
import { NativeSelect, NativeSelectOption } from "@/components/ui/NativeSelect.tsx";
import { Textarea } from "@/components/ui/Textarea.tsx";
import { formatIn, fromWallClock, timeZones, toWallClock } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/settings")({
  component: Settings,
});

type Competition = ReturnType<typeof Route.useRouteContext>["competition"];

function Settings() {
  const { competition, organization } = Route.useRouteContext();
  const canWrite = organization.permissions.includes("competitions:write");

  return (
    <div className="flex flex-col gap-10">
      {/* key: a save resets the fields to what the Api stored. */}
      <Details key={`${competition.name}|${competition.description}|${competition.time_zone}`} competition={competition} canWrite={canWrite} />
      <Window key={`${competition.opens_at}|${competition.closes_at}|${competition.time_zone}`} competition={competition} canWrite={canWrite} />
      <Publishing competition={competition} canWrite={canWrite} />
      {canWrite && <Delete competition={competition} />}
    </div>
  );
}

function useUpdate(id: string) {
  const router = useRouter();
  const update = useMutation(updateCompetitionMutation(id));
  const save = (body: CompetitionUpdate) => update.mutate(body, { onSuccess: () => router.invalidate() });
  return { ...update, save };
}

function Details({ competition, canWrite }: { competition: Competition; canWrite: boolean }) {
  const id = useId();
  const update = useUpdate(competition.id);
  const [name, setName] = useState(competition.name);
  const [description, setDescription] = useState(competition.description);
  const [timeZone, setTimeZone] = useState(competition.time_zone);
  const unchanged =
    name.trim() === competition.name &&
    description.trim() === competition.description &&
    timeZone === competition.time_zone;

  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        update.save({ name: name.trim(), description: description.trim(), time_zone: timeZone });
      }}
      onChange={() => update.isError && update.reset()}
    >
      <Label htmlFor={`${id}-name`}>Name</Label>
      <Input
        id={`${id}-name`}
        required
        maxLength={100}
        disabled={!canWrite}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Label htmlFor={`${id}-description`}>Description</Label>
      <Textarea
        id={`${id}-description`}
        maxLength={2000}
        disabled={!canWrite}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Label htmlFor={`${id}-zone`}>Time zone</Label>
      <NativeSelect id={`${id}-zone`} disabled={!canWrite} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
        {timeZones(competition.time_zone).map((zone) => (
          <NativeSelectOption key={zone} value={zone}>
            {zone.replaceAll("_", " ")}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't save the details. Try again.
        </p>
      )}
      {canWrite && (
        <Button
          type="submit"
          className="justify-self-start"
          disabled={update.isPending || update.isSuccess || unchanged || !name.trim()}
        >
          Save
        </Button>
      )}
    </form>
  );
}

const windowStatus = (competition: Competition, now: Date) => {
  const opens = competition.opens_at ? new Date(competition.opens_at) : null;
  const closes = competition.closes_at ? new Date(competition.closes_at) : null;
  const at = (date: Date) => formatIn(date, competition.time_zone);
  if (closes && closes <= now) return { state: "closed", text: `Closed ${at(closes)}.` } as const;
  if (!opens) return { state: "not-open", text: "Not open yet." } as const;
  if (opens > now) return { state: "not-open", text: `Opens ${at(opens)}.` } as const;
  return { state: "open", text: `Open since ${at(opens)}${closes ? `, closes ${at(closes)}` : ", no deadline"}.` } as const;
};

function Window({ competition, canWrite }: { competition: Competition; canWrite: boolean }) {
  const id = useId();
  const update = useUpdate(competition.id);
  const zone = competition.time_zone;
  const wallClock = (iso: string | null) => (iso ? toWallClock(new Date(iso), zone) : "");
  const [opens, setOpens] = useState(wallClock(competition.opens_at));
  const [closes, setCloses] = useState(wallClock(competition.closes_at));
  const unchanged = opens === wallClock(competition.opens_at) && closes === wallClock(competition.closes_at);
  const status = windowStatus(competition, new Date());
  const now = () => new Date().toISOString();

  return (
    <section className="flex max-w-md flex-col gap-4">
      <div>
        <h2 className="font-medium">Submissions</h2>
        <p className="text-sm text-muted-foreground">{status.text}</p>
      </div>
      {canWrite && (
        <div>
          {status.state === "not-open" && (
            <Button variant="outline" disabled={update.isPending} onClick={() => update.save({ opens_at: now() })}>
              Open submissions now
            </Button>
          )}
          {status.state === "open" && (
            <Button variant="outline" disabled={update.isPending} onClick={() => update.save({ closes_at: now() })}>
              Close submissions now
            </Button>
          )}
          {status.state === "closed" && (
            <Button variant="outline" disabled={update.isPending} onClick={() => update.save({ closes_at: null })}>
              Reopen submissions
            </Button>
          )}
        </div>
      )}
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.save({
            opens_at: opens ? fromWallClock(opens, zone).toISOString() : null,
            closes_at: closes ? fromWallClock(closes, zone).toISOString() : null,
          });
        }}
        onChange={() => update.isError && update.reset()}
      >
        <p className="text-sm text-muted-foreground">
          Or schedule them, in {zone.replaceAll("_", " ")}. Leave closing empty for no deadline.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-opens`}>Opens</Label>
            <Input
              id={`${id}-opens`}
              type="datetime-local"
              disabled={!canWrite}
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-closes`}>Closes</Label>
            <Input
              id={`${id}-closes`}
              type="datetime-local"
              disabled={!canWrite}
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
            />
          </div>
        </div>
        {update.isError && (
          <p role="alert" className="text-sm text-destructive">
            {update.error instanceof ApiError && update.error.status === 400
              ? "Submissions have to close after they open."
              : "Couldn't save the times. Try again."}
          </p>
        )}
        {canWrite && (
          <Button type="submit" className="justify-self-start" disabled={update.isPending || update.isSuccess || unchanged}>
            Save
          </Button>
        )}
      </form>
    </section>
  );
}

function Publishing({ competition, canWrite }: { competition: Competition; canWrite: boolean }) {
  const update = useUpdate(competition.id);
  const published = competition.published_at !== null;

  return (
    <section className="flex flex-col items-start gap-3">
      <div>
        <h2 className="font-medium">{published ? "Published" : "Draft"}</h2>
        <p className="text-sm text-muted-foreground">
          {published
            ? `Participants can find and enter it since ${formatIn(new Date(competition.published_at!), competition.time_zone)}.`
            : "Only your organization can see it. Publish it to let participants enter."}
        </p>
      </div>
      {canWrite && (
        <Button
          variant={published ? "outline" : "default"}
          disabled={update.isPending}
          onClick={() => update.save({ published: !published })}
        >
          {published ? "Unpublish" : "Publish"}
        </Button>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {update.error instanceof ApiError && update.error.status === 409
            ? published
              ? "People have entered, so it can't be unpublished."
              : "Add a topic before publishing."
            : `Couldn't ${published ? "unpublish" : "publish"} the event. Try again.`}
        </p>
      )}
    </section>
  );
}

function Delete({ competition }: { competition: Competition }) {
  const remove = useMutation(deleteCompetitionMutation(competition));
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col items-start gap-3">
      <div>
        <h2 className="font-medium">Delete event</h2>
        <p className="text-sm text-muted-foreground">Its participants and photos go with it.</p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete event
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${competition.name}?`}
        description="Its participants and photos go with it. This can't be undone here."
        action="Delete event"
        onConfirm={() =>
          remove
            .mutateAsync()
            .then(() => navigate({ to: "/dashboard/$organizationId", params: { organizationId: competition.organization_id } }))
        }
        failure="Couldn't delete the event. Try again."
      />
    </section>
  );
}
