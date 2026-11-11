import { createFileRoute, redirect } from "@tanstack/react-router";
import { organizationsQuery } from "../../organizations.ts";

// The gate: the one place that decides where a signed-in organizer goes (v3/plan.md).
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async ({ context }) => {
    const [first] = await context.queryClient.fetchQuery(organizationsQuery);
    if (!first) throw redirect({ to: "/onboarding" });
    throw redirect({ to: "/dashboard/$organizationId", params: { organizationId: first.id } });
  },
});
