import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { participantsQuery } from "@/api/participants.ts";
import { PageHeader } from "@/components/PageHeader.tsx";
import { formatWindow } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(participantsQuery(params.competitionId)),
  component: Event,
});

function Event() {
  const { competition } = Route.useRouteContext();
  const { data: participants } = useSuspenseQuery(participantsQuery(competition.id));
  // Filled in after mount, so the server and browser render the same text.
  const [origin, setOrigin] = useState("");
  // oxlint-disable-next-line react/set-state-in-effect -- set after hydration on purpose, see above
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <span className="font-mono text-xs uppercase">
            {formatWindow(competition.opens_at, competition.closes_at, competition.time_zone)} · {competition.time_zone}
          </span>
        }
      />
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {competition.published_at ? (
            <>
              Participants enter at{" "}
              <a href={`/e/${competition.slug}`} className="font-medium wrap-anywhere">
                {origin}/e/{competition.slug}
              </a>
            </>
          ) : (
            "Publish the event in Settings to let participants enter."
          )}
        </p>
        {participants.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="font-medium">No one has entered yet</p>
            <p className="text-sm text-muted-foreground">Participants show up here as they enter.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium wrap-anywhere">{participant.name || participant.email}</span>
                  <span className="text-sm wrap-anywhere text-muted-foreground">
                    {participant.name && `${participant.email} · `}
                    entered {formatDistanceToNow(new Date(participant.created_at), { addSuffix: true })}
                  </span>
                </div>
                {!participant.signed_in && <span className="text-sm text-muted-foreground">Guest</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
