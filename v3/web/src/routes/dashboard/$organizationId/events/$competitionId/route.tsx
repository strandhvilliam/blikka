import { Link, Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { Badge } from "@/components/ui/Badge.tsx";
import { buttonVariants } from "@/components/ui/Button.tsx";
import { competitionQuery } from "@/api/competitions.ts";

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
  component: EventLayout,
});

const pages = [
  { to: "/dashboard/$organizationId/events/$competitionId", label: "Overview" },
  { to: "/dashboard/$organizationId/events/$competitionId/topics", label: "Topics" },
  { to: "/dashboard/$organizationId/events/$competitionId/settings", label: "Settings" },
] as const;

function EventLayout() {
  const { competition } = Route.useRouteContext();
  const params = { organizationId: competition.organization_id, competitionId: competition.id };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold">{competition.name}</h1>
          {!competition.published_at && <Badge variant="secondary">Draft</Badge>}
        </div>
        <nav className="-ml-2.5 flex gap-1">
          {pages.map((page) => (
            <Link
              key={page.to}
              to={page.to}
              params={params}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-muted" }}
            >
              {page.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </main>
  );
}
