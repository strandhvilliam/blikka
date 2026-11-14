import { IconCheck, IconChevronDown, IconPlus, IconSelector } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, notFound, useParams } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/Breadcrumb.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/DropdownMenu.tsx";
import { competitionQuery } from "../../../competitions.ts";
import { organizationQuery, organizationsQuery } from "../../../organizations.ts";
import { useSignOut } from "../../../session.ts";

// Loads the organization once for every page under it, which read it from their route context.
export const Route = createFileRoute("/dashboard/$organizationId")({
  beforeLoad: async ({ context, params }) => {
    const organization = await context.queryClient.ensureQueryData(organizationQuery(params.organizationId));
    if (!organization) throw notFound();
    return { organization };
  },
  component: OrganizationLayout,
});

function OrganizationLayout() {
  const { organization, session } = Route.useRouteContext();
  const { data: organizations } = useQuery(organizationsQuery);
  // On an event's page: its loader has already cached the competition, so this doesn't fetch.
  const { competitionId } = useParams({ strict: false });
  const { data: competition } = useQuery({ ...competitionQuery(competitionId ?? ""), enabled: !!competitionId });
  const signOut = useSignOut();

  return (
    <div className="min-h-svh">
      <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
        <Breadcrumb className="min-w-0">
          <BreadcrumbList>
            <BreadcrumbItem className="font-semibold text-foreground max-sm:hidden">Blikka</BreadcrumbItem>
            <BreadcrumbSeparator className="max-sm:hidden">/</BreadcrumbSeparator>
            <BreadcrumbItem className="min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="min-w-0" />}>
                  <span className="truncate">{organization.name}</span>
                  <IconSelector className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                    {organizations?.map((o) => (
                      <DropdownMenuItem
                        key={o.id}
                        render={<Link to="/dashboard/$organizationId" params={{ organizationId: o.id }} />}
                      >
                        {o.name}
                        {o.id === organization.id && <IconCheck className="ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link to="/onboarding" />}>
                    <IconPlus />
                    New organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            {competition && (
              <>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={<Link to="/dashboard/$organizationId" params={{ organizationId: organization.id }} />}
                  >
                    Events
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>{competition.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/dashboard/$organizationId/members" params={{ organizationId: organization.id }} />}
          >
            Members
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              {session.user.name || session.user.email}
              <IconChevronDown className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
