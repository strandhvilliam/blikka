import { IconUsers } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { participantsQuery } from "@/api/participants.ts";
import { topicsQuery } from "@/api/topics.ts";
import { Card } from "@/components/Card.tsx";
import { EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { formatIn } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/participants")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(participantsQuery(params.competitionId)),
      context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
    ]),
  component: Participants,
});

function Participants() {
  const { competition } = Route.useRouteContext();
  const { data: participants } = useSuspenseQuery(participantsQuery(competition.id));
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));

  return (
    <>
      <PageHeader title="Participants" description="Everyone who has entered, as a guest or with an account." />
      <Card className="overflow-hidden">
        {participants.length === 0 ? (
          <EmptyState
            icon={IconUsers}
            title="No one has entered yet"
            description={
              competition.published_at
                ? "Participants show up here as they enter. Share the entry page to get them in."
                : "Publish the event in Settings to let participants enter."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-page text-xs text-muted-foreground">
              <tr>
                <th className="h-9 px-5 text-start font-medium">Name</th>
                <th className="px-3 text-start font-medium max-md:hidden">Email</th>
                <th className="w-28 px-3 text-start font-medium max-sm:hidden">Entered as</th>
                <th className="w-20 px-3 text-end font-medium">Done</th>
                <th className="w-48 px-5 text-end font-medium max-sm:hidden">Entered</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                // The name's link stretches over the row, so the whole row opens the entry.
                <tr
                  key={participant.id}
                  className="relative border-b border-border last:border-0 hover:bg-muted/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring"
                >
                  <td className="h-11 px-5 font-medium wrap-anywhere">
                    <Link
                      to="/dashboard/$organizationId/events/$competitionId/participants/$participantId"
                      params={{
                        organizationId: competition.organization_id,
                        competitionId: competition.id,
                        participantId: participant.id,
                      }}
                      className="no-underline outline-none after:absolute after:inset-0"
                    >
                      {participant.name || participant.email}
                    </Link>
                  </td>
                  <td className="px-3 wrap-anywhere text-muted-foreground max-md:hidden">{participant.email}</td>
                  <td className="px-3 max-sm:hidden">
                    <span
                      className={`inline-flex rounded-[7px] px-2 py-0.5 text-xs font-medium ${participant.signed_in ? "bg-muted" : "text-muted-foreground ring-1 ring-border ring-inset"}`}
                    >
                      {participant.signed_in ? "Account" : "Guest"}
                    </span>
                  </td>
                  <td className="px-3 text-end font-mono text-xs whitespace-nowrap">
                    {participant.submissions}
                    <span className="text-muted-foreground">/{topics.length}</span>
                  </td>
                  <td className="px-5 text-end font-mono text-xs whitespace-nowrap text-muted-foreground max-sm:hidden">
                    {formatIn(new Date(participant.created_at), competition.time_zone)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
