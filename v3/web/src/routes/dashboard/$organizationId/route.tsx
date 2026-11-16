import { IconCheck, IconChevronDown, IconPlus, IconSelector } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, notFound, useMatchRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ui-sdk/react/navigation-menu";
import { competitionQuery } from "@/api/competitions.ts";
import { acceptInvitationMutation, invitedBy, receivedInvitationsQuery } from "@/api/invitations.ts";
import { organizationQuery, organizationsQuery } from "@/api/organizations.ts";
import { useSignOut } from "@/api/session.ts";

// Loads the organization once for every page under it, which read it from their route context.
export const Route = createFileRoute("/dashboard/$organizationId")({
  beforeLoad: async ({ context, params }) => {
    const organization = await context.queryClient.ensureQueryData(organizationQuery(params.organizationId));

    if (!organization) {
      throw notFound();
    }

    return { organization };
  },
  component: OrganizationLayout,
});

const pages = [
  { to: "/dashboard/$organizationId/members", label: "Members" },
  { to: "/dashboard/$organizationId/settings", label: "Settings" },
] as const;

function OrganizationLayout() {
  const { organization, session } = Route.useRouteContext();
  const { data: organizations } = useQuery(organizationsQuery);
  const { data: invitations } = useQuery(receivedInvitationsQuery);
  const accept = useMutation(acceptInvitationMutation);
  const navigate = useNavigate();
  // On an event's page: its loader has already cached the competition, so this doesn't fetch.
  const { competitionId } = useParams({ strict: false });
  const { data: competition } = useQuery({ ...competitionQuery(competitionId ?? ""), enabled: !!competitionId });
  const signOut = useSignOut();
  const matchRoute = useMatchRoute();

  return (
    <div className="min-h-svh">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <li className="font-semibold text-foreground max-sm:hidden">Blikka</li>
            <li aria-hidden className="max-sm:hidden">
              /
            </li>
            <li className="min-w-0">
              <Menu>
                <MenuTrigger className="max-w-full min-w-0">
                  <span className="truncate">{organization.name}</span>
                  {invitations?.length ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary">
                      <span className="sr-only">, you have invitations</span>
                    </span>
                  ) : null}
                  <IconSelector aria-hidden />
                </MenuTrigger>
                <MenuContent align="start">
                  <MenuGroup>
                    <MenuGroupLabel>Organizations</MenuGroupLabel>
                    {organizations?.map((o) => (
                      <MenuItem
                        key={o.id}
                        render={<Link to="/dashboard/$organizationId" params={{ organizationId: o.id }} />}
                      >
                        <span className="truncate">{o.name}</span>
                        {o.id === organization.id && <IconCheck aria-hidden className="ms-auto" />}
                      </MenuItem>
                    ))}
                  </MenuGroup>
                  {invitations?.length ? (
                    <>
                      <MenuSeparator />
                      <MenuGroup>
                        <MenuGroupLabel>Invitations</MenuGroupLabel>
                        {invitations.map((invitation) => (
                          <MenuItem
                            key={invitation.id}
                            onSelect={() =>
                              accept.mutateAsync(invitation.id).then(({ organization_id }) =>
                                navigate({
                                  to: "/dashboard/$organizationId",
                                  params: { organizationId: organization_id },
                                }),
                              )
                            }
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">{invitation.organization.name}</span>
                              <span className="text-xs wrap-anywhere text-muted-foreground">
                                {invitedBy(invitation)}
                              </span>
                            </span>
                            <span className="ms-auto font-medium">Join</span>
                          </MenuItem>
                        ))}
                      </MenuGroup>
                    </>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem render={<Link to="/onboarding" />}>
                    <IconPlus aria-hidden />
                    New organization
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
            {competition && (
              <>
                <li aria-hidden>/</li>
                <li>
                  <Link to="/dashboard/$organizationId" params={{ organizationId: organization.id }}>
                    Events
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="min-w-0 truncate text-foreground">
                  {competition.name}
                </li>
              </>
            )}
          </ol>
        </nav>
        <div className="flex min-w-0 items-center gap-1">
          <NavigationMenu aria-label="Organization" className="max-sm:hidden">
            <NavigationMenuList>
              {pages.map((page) => (
                <NavigationMenuItem key={page.to}>
                  <NavigationMenuLink
                    render={<Link to={page.to} params={{ organizationId: organization.id }} />}
                    current={!!matchRoute({ to: page.to, params: { organizationId: organization.id } })}
                  >
                    {page.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <Menu>
            <MenuTrigger className="min-w-0 max-sm:max-w-40">
              <span className="truncate">{session.user.name || session.user.email}</span>
              <IconChevronDown aria-hidden />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuGroup>
                <MenuGroupLabel className="wrap-anywhere">{session.user.email}</MenuGroupLabel>
              </MenuGroup>
              <MenuSeparator />
              {/* On phones the header has no room for the pages, so they live here. */}
              {pages.map((page) => (
                <MenuItem
                  key={page.to}
                  className="sm:hidden"
                  render={<Link to={page.to} params={{ organizationId: organization.id }} />}
                >
                  {page.label}
                </MenuItem>
              ))}
              <MenuSeparator className="sm:hidden" />
              <MenuItem onSelect={signOut}>Sign out</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
