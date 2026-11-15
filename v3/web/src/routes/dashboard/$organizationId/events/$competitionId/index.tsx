import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { participantsQuery } from "@/api/participants.ts";
import { Badge } from "@/components/ui/Badge.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/Empty.tsx";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/Item.tsx";

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
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {competition.published_at ? (
          <>
            Participants enter at{" "}
            <a
              href={`/e/${competition.slug}`}
              className="font-medium text-foreground underline underline-offset-4 wrap-anywhere"
            >
              {origin}/e/{competition.slug}
            </a>
          </>
        ) : (
          "Publish the event in Settings to let participants enter."
        )}
      </p>
      {participants.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No one has entered yet</EmptyTitle>
            <EmptyDescription>Participants show up here as they enter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {participants.map((participant) => (
            <Item key={participant.id} variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle className="wrap-anywhere">{participant.name || participant.email}</ItemTitle>
                <ItemDescription className="wrap-anywhere">
                  {participant.name && `${participant.email} · `}
                  entered {formatDistanceToNow(new Date(participant.created_at), { addSuffix: true })}
                </ItemDescription>
              </ItemContent>
              {!participant.signed_in && (
                <ItemActions>
                  <Badge variant="secondary">Guest</Badge>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
