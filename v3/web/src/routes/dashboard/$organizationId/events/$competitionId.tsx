import { createFileRoute, notFound } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../../../components/ui/Empty.tsx";
import { competitionQuery } from "../../../../competitions.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId")({
  loader: async ({ context, params }) => {
    const competition = await context.queryClient.ensureQueryData(competitionQuery(params.competitionId));
    // The Api finds a competition by its id alone, so a URL naming another of the caller's
    // organizations would otherwise show it under the wrong one.
    if (!competition || competition.organization_id !== params.organizationId) throw notFound();
    return competition;
  },
  component: Event,
});

function Event() {
  const competition = Route.useLoaderData();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{competition.name}</h1>
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Nothing here yet</EmptyTitle>
          <EmptyDescription>Participants and their photos will show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
