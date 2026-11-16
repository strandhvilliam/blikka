import { IconArrowLeft, IconListNumbers } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { deleteParticipantMutation, participantQuery, submissionsQuery } from "@/api/participants.ts";
import { topicsQuery } from "@/api/topics.ts";
import { Card } from "@/components/Card.tsx";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { formatIn } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/participants_/$participantId")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(participantQuery(params.participantId)),
      context.queryClient.ensureQueryData(submissionsQuery(params.participantId)),
      context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
    ]),
  component: ParticipantDetail,
});

function ParticipantDetail() {
  const { competition, organization } = Route.useRouteContext();
  const { participantId } = Route.useParams();
  const { data: participant } = useSuspenseQuery(participantQuery(participantId));
  const { data: submissions } = useSuspenseQuery(submissionsQuery(participantId));
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));
  const remove = useMutation(deleteParticipantMutation(competition.id));
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const canWrite = organization.permissions.includes("participants:write");
  const params = { organizationId: competition.organization_id, competitionId: competition.id };
  const doneAt = new Map(submissions.map((submission) => [submission.topic_id, submission.created_at]));
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const closed = competition.closes_at !== null && new Date(competition.closes_at) <= new Date();
  const name = participant.name || participant.email;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/$organizationId/events/$competitionId/participants"
        params={params}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <IconArrowLeft aria-hidden className="size-4" />
        Participants
      </Link>
      <PageHeader
        title={name}
        description={
          <>
            {participant.email} · {participant.signed_in ? "Account" : "Guest"} · entered{" "}
            <span className="font-mono text-xs">
              {formatIn(new Date(participant.created_at), competition.time_zone)}
            </span>
          </>
        }
      >
        {canWrite && (
          <Button data-variant="destructive" onClick={() => setConfirming(true)}>
            Delete entry
          </Button>
        )}
      </PageHeader>
      <Card className="overflow-hidden">
        <div className="flex h-12 items-center gap-2 border-b border-border px-5">
          <h2 className="font-semibold">Topics</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {participant.submissions}/{topics.length}
          </span>
        </div>
        {topics.length === 0 ? (
          <EmptyState icon={IconListNumbers} title="No topics yet" description="Add topics to the event first." />
        ) : (
          <ol className="divide-y divide-border">
            {topics.map((topic, index) => {
              const at = doneAt.get(topic.id);

              return (
                <li key={topic.id} className="flex min-h-11 items-center gap-3 px-5 py-2 text-sm">
                  {/* A frame number, like the roll's 04/08. */}
                  <span className="w-5 shrink-0 text-end font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 font-medium wrap-anywhere">{topic.name}</span>
                  <TopicStatus at={at} closed={closed} timeZone={competition.time_zone} />
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${name}'s entry?`}
        description="They're removed from the event and their submissions stop counting. They can enter again with the same email."
        action="Delete entry"
        onConfirm={() =>
          remove
            .mutateAsync(participant.id)
            .then(() => navigate({ to: "/dashboard/$organizationId/events/$competitionId/participants", params }))
        }
        failure="Couldn't delete the entry. Try again."
      />
    </div>
  );
}

// Done once submitted; after the event closes, a topic that wasn't is missed.
function TopicStatus({ at, closed, timeZone }: { at: string | undefined; closed: boolean; timeZone: string }) {
  if (at) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground max-sm:hidden">
          {formatIn(new Date(at), timeZone)}
        </span>
        <span aria-hidden className="size-2 rounded-full bg-leaf" />
        Done
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
      <span
        aria-hidden
        className={`size-2 rounded-full ${closed ? "bg-muted-foreground" : "border-[1.5px] border-muted-foreground"}`}
      />
      {closed ? "Missed" : "Not done"}
    </span>
  );
}
