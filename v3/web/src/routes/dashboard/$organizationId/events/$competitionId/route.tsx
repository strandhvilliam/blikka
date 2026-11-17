import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { competitionQuery } from "@/api/competitions.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId")({
  beforeLoad: async ({ context, params }) => {
    const competition = await context.queryClient.ensureQueryData(competitionQuery(params.competitionId));

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
