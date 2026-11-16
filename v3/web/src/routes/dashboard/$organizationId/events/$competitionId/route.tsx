import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { competitionQuery } from "@/api/competitions.ts";

// The organization's layout shows the event's pages in its sidebar; this loads the event for them.
export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId")({
  beforeLoad: async ({ context, params }) => {
    const competition = await context.queryClient.ensureQueryData(competitionQuery(params.competitionId));

    // The Api finds a competition by its id alone, so a URL naming another of the caller's
    // organizations would otherwise show it under the wrong one.
    if (!competition || competition.organization_id !== params.organizationId) {
      throw notFound();
    }

    return { competition };
  },
  component: () => (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <Outlet />
    </main>
  ),
});
