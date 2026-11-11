import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$organizationId/")({ component: Dashboard });

function Dashboard() {
  const { organization } = Route.useRouteContext();
  return (
    <main>
      <h1>{organization.name}</h1>
    </main>
  );
}
