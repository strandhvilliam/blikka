import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@ui-sdk/react/combobox";
import { DatePicker, DatePickerContent, DatePickerInput, DatePickerTrigger } from "@ui-sdk/react/date-picker";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Textarea } from "@ui-sdk/react/textarea";
import { TimeInput } from "@ui-sdk/react/time-input";
import { isApiError } from "@/api/client.ts";
import { type CompetitionUpdate, deleteCompetitionMutation, updateCompetitionMutation } from "@/api/competitions.ts";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { formatIn, fromWallClock, timeZones, toWallClock } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/settings")({
  component: Settings,
});

type Competition = ReturnType<typeof Route.useRouteContext>["competition"];

function Settings() {
  const { competition, organization } = Route.useRouteContext();
  const canWrite = organization.permissions.includes("competitions:write");

  return (
    <>
      <PageHeader
        title="Settings"
        description="When the event runs, what participants submit, and whether it's published."
      />
      <div className="flex flex-col gap-10">
        {/* key: a save resets the fields to what the Api stored. */}
        <Details
          key={`${competition.name}|${competition.description}|${competition.time_zone}`}
          competition={competition}
          canWrite={canWrite}
        />
        <Window
          key={`${competition.opens_at}|${competition.closes_at}|${competition.time_zone}`}
          competition={competition}
          canWrite={canWrite}
        />
        <Publishing competition={competition} canWrite={canWrite} />
        {canWrite && <Delete competition={competition} />}
      </div>
    </>
  );
}

function useUpdate(id: string) {
  const router = useRouter();
  const update = useMutation(updateCompetitionMutation(id));
  const save = (body: CompetitionUpdate) => update.mutate(body, { onSuccess: () => router.invalidate() });

  return { ...update, save };
}

function Details({ competition, canWrite }: { competition: Competition; canWrite: boolean }) {
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
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        update.save({ name: name.trim(), description: description.trim(), time_zone: timeZone });
      }}
      onChange={() => update.isError && update.reset()}
    >
      <Field disabled={!canWrite}>
        <FieldLabel>Name</FieldLabel>
        <Input required maxLength={100} value={name} onValueChange={setName} />
      </Field>
      <Field disabled={!canWrite}>
        <FieldLabel>Description</FieldLabel>
        <Textarea autoResize maxLength={2000} value={description} onValueChange={setDescription} />
      </Field>
      <Combobox
        items={timeZones(competition.time_zone).map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
        value={timeZone}
        onValueChange={(zone) => zone && setTimeZone(zone)}
        disabled={!canWrite}
        autoHighlight
      >
        <div className="flex flex-col gap-1.5">
          <ComboboxLabel>Time zone</ComboboxLabel>
          <div>
            <ComboboxInput />
            <ComboboxTrigger aria-label="Show time zones" />
          </div>
        </div>
        <ComboboxContent>
          <ComboboxEmpty>No time zone matches.</ComboboxEmpty>
          <ComboboxList />
        </ComboboxContent>
      </Combobox>
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't save the details. Try again.
        </p>
      )}
      {canWrite && (
        <Button
          type="submit"
          data-variant="solid"
          className="self-start"
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

  if (closes && closes <= now) {
    return { state: "closed", text: `Closed ${at(closes)}.` } as const;
  }

  if (!opens) {
    return { state: "not-open", text: "Not open yet." } as const;
  }

  if (opens > now) {
    return { state: "not-open", text: `Opens ${at(opens)}.` } as const;
  }

  return {
    state: "open",
    text: `Open since ${at(opens)}${closes ? `, closes ${at(closes)}` : ", no deadline"}.`,
  } as const;
};

// A wall clock time like "2026-12-01T09:00" as a date picker and a time input. Choosing a date asks
// for a time too; clearing the date clears both.
function WallClockInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [date, setDate] = useState(value.slice(0, 10) || null);
  const [time, setTime] = useState(value.slice(11) || null);
  const emit = (date: string | null, time: string | null) => onChange(date && time ? `${date}T${time}` : "");

  return (
    <FieldSet>
      <FieldLegend>{label}</FieldLegend>
      <div className="flex flex-wrap gap-2">
        <DatePicker
          value={date}
          onValueChange={(next) => {
            // A single-date picker never reports a range.
            const day = Array.isArray(next) ? null : next;
            setDate(day);
            emit(day, time);
          }}
        >
          <div className="flex gap-1">
            <DatePickerInput aria-label={`${label}, date`} />
            <DatePickerTrigger aria-label={`Choose the ${label.toLowerCase()} date`} />
          </div>
          <DatePickerContent />
        </DatePicker>
        <TimeInput
          aria-label={`${label}, time`}
          required={date !== null}
          value={time}
          onValueChange={(next) => {
            setTime(next);
            emit(date, next);
          }}
        />
      </div>
    </FieldSet>
  );
}

function Window({ competition, canWrite }: { competition: Competition; canWrite: boolean }) {
  const update = useUpdate(competition.id);
  const zone = competition.time_zone;
  const wallClock = (iso: string | null) => (iso ? toWallClock(new Date(iso), zone) : "");
  const [opens, setOpens] = useState(wallClock(competition.opens_at));
  const [closes, setCloses] = useState(wallClock(competition.closes_at));
  const unchanged = opens === wallClock(competition.opens_at) && closes === wallClock(competition.closes_at);
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
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
            <Button disabled={update.isPending} onClick={() => update.save({ opens_at: now() })}>
              Open submissions now
            </Button>
          )}
          {status.state === "open" && (
            <Button disabled={update.isPending} onClick={() => update.save({ closes_at: now() })}>
              Close submissions now
            </Button>
          )}
          {status.state === "closed" && (
            <Button disabled={update.isPending} onClick={() => update.save({ closes_at: null })}>
              Reopen submissions
            </Button>
          )}
        </div>
      )}
      <form
        className="flex flex-col gap-4"
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
        <fieldset disabled={!canWrite} className="contents">
          <WallClockInput label="Opens" value={opens} onChange={setOpens} />
          <WallClockInput label="Closes" value={closes} onChange={setCloses} />
        </fieldset>
        {update.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(update.error, "CompetitionWindowInvalid")
              ? "Submissions have to close after they open."
              : "Couldn't save the times. Try again."}
          </p>
        )}
        {canWrite && (
          <Button
            type="submit"
            data-variant="solid"
            className="self-start"
            disabled={update.isPending || update.isSuccess || unchanged}
          >
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
          data-variant={published ? undefined : "solid"}
          disabled={update.isPending}
          onClick={() => update.save({ published: !published })}
        >
          {published ? "Unpublish" : "Publish"}
        </Button>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(update.error, "CompetitionHasParticipants")
            ? "People have entered, so it can't be unpublished."
            : isApiError(update.error, "CompetitionHasNoTopics")
              ? "Add a topic before publishing."
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
      <Button data-variant="destructive" onClick={() => setOpen(true)}>
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
            .then(() =>
              navigate({ to: "/dashboard/$organizationId", params: { organizationId: competition.organization_id } }),
            )
        }
        failure="Couldn't delete the event. Try again."
      />
    </section>
  );
}
