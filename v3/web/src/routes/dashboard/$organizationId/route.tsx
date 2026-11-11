import { createFileRoute, notFound } from "@tanstack/react-router";
import { organizationQuery } from "../../../organizations.ts";

// Loads the organization once for every page under it, which read it from their route context.
export const Route = createFileRoute("/dashboard/$organizationId")({
  beforeLoad: async ({ context, params }) => {
    const organization = await context.queryClient.ensureQueryData(organizationQuery(params.organizationId));
    if (!organization) throw notFound();
    return { organization };
  },
});
