import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { organizationQuery } from "../../organizations.ts";

export const Route = createFileRoute("/dashboard/$organizationId")({
  loader: async ({ context, params }) => {
    const organization = await context.queryClient.ensureQueryData(organizationQuery(params.organizationId));
    if (!organization) throw notFound();
  },
  component: Dashboard,
});

function Dashboard() {
  const { organizationId } = Route.useParams();
  // The loader threw notFound() for null, so the organization is here.
  const { data: organization } = useSuspenseQuery(organizationQuery(organizationId));
  return (
    <main>
      <h1>{organization!.name}</h1>
    </main>
  );
}
