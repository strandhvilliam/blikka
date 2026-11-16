import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Textarea } from "@ui-sdk/react/textarea";
import { isApiError } from "@/api/client.ts";
import { type CompetitionUpdate, deleteCompetitionMutation, updateCompetitionMutation } from "@/api/competitions.ts";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Saved, Section } from "@/components/Section.tsx";
import { TimeZoneCombobox } from "@/components/TimeZoneCombobox.tsx";
import { WallClockInput } from "@/components/WallClockInput.tsx";
import { formatIn, fromWallClock, toWallClock } from "@/lib/timeZone.ts";

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
      <div className="flex flex-col gap-6">
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
      onSubmit={(e) => {
        e.preventDefault();
        update.save({ name: name.trim(), description: description.trim(), time_zone: timeZone });
      }}
      onChange={() => update.isError && update.reset()}
    >
      <Section
        title="Details"
        description="What participants see on the entry page, and the time zone its times are in."
        footer={
          <>
            {update.isError && (
              <p role="alert" className="me-auto text-sm text-destructive">
                Couldn't save the details. Try again.
              </p>
            )}
            {update.isSuccess && unchanged && <Saved />}
            {canWrite && (
              <Button
                type="submit"
                data-variant="solid"
                disabled={update.isPending || update.isSuccess || unchanged || !name.trim()}
              >
                Save
              </Button>
            )}
          </>
        }
      >
        <Field disabled={!canWrite}>
          <FieldLabel>Name</FieldLabel>
          <Input required maxLength={100} value={name} onValueChange={setName} />
        </Field>
        <Field disabled={!canWrite}>
          <FieldLabel>Description</FieldLabel>
          <Textarea autoResize maxLength={2000} value={description} onValueChange={setDescription} />
        </Field>
        <TimeZoneCombobox value={timeZone} onChange={setTimeZone} disabled={!canWrite} />
      </Section>
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.save({
          opens_at: opens ? fromWallClock(opens, zone).toISOString() : null,
          closes_at: closes ? fromWallClock(closes, zone).toISOString() : null,
        });
      }}
      onChange={() => update.isError && update.reset()}
    >
      <Section
        title="Submissions"
        description={
          <span className="flex items-start gap-2">
            <span
              aria-hidden
              className={`mt-[7px] size-1.5 shrink-0 rounded-full ${status.state === "open" ? "bg-safelight" : status.state === "closed" ? "bg-muted-foreground" : "bg-blue-hour"}`}
            />
            {status.text}
          </span>
        }
        aside={
          canWrite && (
            <>
              {status.state === "not-open" && (
                <Button type="button" disabled={update.isPending} onClick={() => update.save({ opens_at: now() })}>
                  Open submissions now
                </Button>
              )}
              {status.state === "open" && (
                <Button type="button" disabled={update.isPending} onClick={() => update.save({ closes_at: now() })}>
                  Close submissions now
                </Button>
              )}
              {status.state === "closed" && (
                <Button type="button" disabled={update.isPending} onClick={() => update.save({ closes_at: null })}>
                  Reopen submissions
                </Button>
              )}
            </>
          )
        }
        footer={
          <>
            {update.isSuccess && unchanged ? (
              <Saved />
            ) : (
              <p className="me-auto text-sm text-muted-foreground">
                {update.isError ? (
                  <span role="alert" className="text-destructive">
                    {isApiError(update.error, "CompetitionWindowInvalid")
                      ? "Submissions have to close after they open."
                      : "Couldn't save the times. Try again."}
                  </span>
                ) : (
                  <>Times in {zone.replaceAll("_", " ")}. Leave closing empty for no deadline.</>
                )}
              </p>
            )}
            {canWrite && (
              <Button type="submit" data-variant="solid" disabled={update.isPending || update.isSuccess || unchanged}>
                Save
              </Button>
            )}
          </>
        }
      >
        <fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2">
          <WallClockInput label="Opens" value={opens} onChange={setOpens} />
          <WallClockInput label="Closes" value={closes} onChange={setCloses} />
        </fieldset>
      </Section>
    </form>
  );
}

function Publishing({ competition, canWrite }: { competition: Competition; canWrite: boolean }) {
  const update = useUpdate(competition.id);
  const published = competition.published_at !== null;

  return (
    <Section
      title={published ? "Published" : "Draft"}
      description={
        published
          ? `Participants can find and enter it since ${formatIn(new Date(competition.published_at!), competition.time_zone)}.`
          : "Only your organization can see it. Publish it to let participants enter."
      }
      aside={
        canWrite && (
          <Button
            data-variant={published ? undefined : "solid"}
            disabled={update.isPending}
            onClick={() => update.save({ published: !published })}
          >
            {published ? "Unpublish" : "Publish"}
          </Button>
        )
      }
    >
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(update.error, "CompetitionHasParticipants")
            ? "People have entered, so it can't be unpublished."
            : isApiError(update.error, "CompetitionHasNoTopics")
              ? "Add a topic before publishing."
              : `Couldn't ${published ? "unpublish" : "publish"} the event. Try again.`}
        </p>
      )}
    </Section>
  );
}

function Delete({ competition }: { competition: Competition }) {
  const remove = useMutation(deleteCompetitionMutation(competition));
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Section
        tone="danger"
        title="Delete event"
        description="Its participants and photos go with it."
        footer={
          <Button data-variant="destructive" onClick={() => setOpen(true)}>
            Delete event
          </Button>
        }
      />
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
    </>
  );
}
