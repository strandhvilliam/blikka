import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/Empty.tsx";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/")({
  component: Event,
});

function Event() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Nothing here yet</EmptyTitle>
        <EmptyDescription>Participants and their photos will show up here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
