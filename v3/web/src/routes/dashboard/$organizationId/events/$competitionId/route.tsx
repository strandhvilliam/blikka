import { Link, Outlet, createFileRoute, notFound, useMatchRoute } from "@tanstack/react-router";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ui-sdk/react/navigation-menu";
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
  const matchRoute = useMatchRoute();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold">{competition.name}</h1>
          {!competition.published_at && <span className="text-sm text-muted-foreground">Draft</span>}
        </div>
        <NavigationMenu aria-label="Event" className="-ms-3">
          <NavigationMenuList>
            {pages.map((page) => (
              <NavigationMenuItem key={page.to}>
                <NavigationMenuLink
                  render={<Link to={page.to} params={params} />}
                  current={!!matchRoute({ to: page.to, params })}
                >
                  {page.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      <Outlet />
    </main>
  );
}
