import {
  IconCalendarEvent,
  IconCheck,
  IconMenu2,
  IconPlus,
  IconSelector,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePreference } from "@ui-sdk/react/preferences";
import { Link, Outlet, createFileRoute, notFound, useMatchRoute, useNavigate, useParams } from "@tanstack/react-router";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ui-sdk/react/navigation-menu";
import { Drawer, DrawerBackdrop, DrawerContent, DrawerTitle, DrawerTrigger } from "@ui-sdk/react/drawer";
import { type Competition, competitionQuery } from "@/api/competitions.ts";
import { acceptInvitationMutation, invitedBy, receivedInvitationsQuery } from "@/api/invitations.ts";
import { organizationQuery, organizationsQuery } from "@/api/organizations.ts";
import { useSignOut } from "@/api/session.ts";
import { colorScheme } from "@/lib/colorScheme.ts";
import { EntryLinks } from "@/components/EntryLinks.tsx";
import { EventNav, EventPicker, breadcrumbTrigger, navLinkClass } from "@/components/EventNav.tsx";

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
  { to: "/dashboard/$organizationId", label: "Events", icon: IconCalendarEvent },
  { to: "/dashboard/$organizationId/members", label: "Members", icon: IconUsers },
  { to: "/dashboard/$organizationId/settings", label: "Settings", icon: IconSettings },
] as const;

// One sidebar on the left, a top bar, and the page in a panel beside them. The sidebar lists the
// organization's pages, or the event's while inside one. On phones it opens from the top bar.
function OrganizationLayout() {
  const { competitionId } = useParams({ strict: false });
  // Filled by the event route's beforeLoad. Read from the query, not that route's context, so a
  // rename in its settings shows here too. Null when the event route throws notFound.
  const { data: competition } = useQuery({ ...competitionQuery(competitionId ?? ""), enabled: !!competitionId });
  const event = competitionId ? competition : undefined;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    // Body text is 14px across the dashboard, like ui-sdk's components (--ui-font-size).
    <div className="flex h-svh flex-col overflow-hidden bg-sidebar text-sm">
      <header className="flex h-12 shrink-0 items-center gap-1 pe-3">
        {/* As wide as the sidebar, so the breadcrumb starts where the page does. */}
        <div className="flex shrink-0 items-center ps-2 md:w-60 md:ps-5">
          <Drawer side="left" open={menuOpen} onOpenChange={setMenuOpen}>
            <DrawerTrigger
              aria-label="Menu"
              className="size-9 shrink-0 border-transparent bg-transparent p-0 md:hidden"
            >
              <IconMenu2 aria-hidden />
            </DrawerTrigger>
            <DrawerBackdrop className="bg-black/30" />
            {/* A link pressed in it leads away, so the drawer closes behind it. */}
            <DrawerContent
              className="h-full max-h-none w-72 max-w-[85vw] gap-0 rounded-none border-0 bg-sidebar p-0 pt-3"
              onClick={(e) => e.target instanceof Element && e.target.closest("a") && setMenuOpen(false)}
            >
              <DrawerTitle className="sr-only">Menu</DrawerTitle>
              <Sidebar competition={event} />
            </DrawerContent>
          </Drawer>
          <BlikkaMark className="h-4 max-md:hidden" />
        </div>
        <Breadcrumb competition={event} />
        {event && <EntryLinks competition={event} />}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 max-md:hidden">
          <Sidebar competition={event} />
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto border-border bg-page md:rounded-tl-xl md:border-s md:border-t max-md:border-t">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function Sidebar({ competition }: { competition: Competition | null | undefined }) {
  const { organization, session } = Route.useRouteContext();
  const matchRoute = useMatchRoute();
  const params = { organizationId: organization.id };

  return (
    <div className="flex h-full flex-col gap-5 p-3 pt-1">
      {competition ? (
        <EventNav competition={competition} />
      ) : (
        <NavigationMenu aria-label="Organization" orientation="vertical">
          <NavigationMenuList>
            {pages.map((page) => (
              <NavigationMenuItem key={page.to}>
                <NavigationMenuLink
                  className={navLinkClass}
                  render={<Link to={page.to} params={params} />}
                  current={!!matchRoute({ to: page.to, params })}
                >
                  <page.icon aria-hidden />
                  {page.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      )}

      <Menu>
        <MenuTrigger className="mt-auto h-10 w-full justify-start gap-2 border-transparent bg-transparent px-2 font-normal hover:bg-foreground/5">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium"
          >
            {(session.user.name || session.user.email).charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{session.user.name || session.user.email}</span>
        </MenuTrigger>
        <MenuContent align="start" side="top">
          <AccountMenuGroups email={session.user.email} />
        </MenuContent>
      </Menu>
    </div>
  );
}

// Where you are, and the switchers to go elsewhere: the organization, then the event inside one.
function Breadcrumb({ competition }: { competition: Competition | null | undefined }) {
  const { organization } = Route.useRouteContext();
  const { data: invitations } = useQuery(receivedInvitationsQuery);
  const invited = invitations?.length ? <span className="sr-only">, you have invitations</span> : null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        <li className={`flex min-w-0 items-center ${competition ? "shrink-[2]" : ""}`}>
          <Menu>
            <MenuTrigger
              aria-label={`${organization.name}, switch organization`}
              className={`${breadcrumbTrigger} relative`}
            >
              <Monogram name={organization.name} />
              <span className={`truncate ${competition ? "text-muted-foreground max-sm:hidden" : ""}`}>
                {organization.name}
              </span>
              <IconSelector aria-hidden className="shrink-0 text-muted-foreground" />
              {invited && <span className="absolute start-1 top-1 size-2 rounded-full bg-primary">{invited}</span>}
            </MenuTrigger>
            <MenuContent align="start">
              <OrganizationMenuGroup organizationId={organization.id} />
              <MenuSeparator />
              <JoinMenuGroups />
            </MenuContent>
          </Menu>
        </li>
        {competition && (
          <>
            <li aria-hidden className="text-border">
              /
            </li>
            <li className="flex min-w-0 items-center">
              <EventPicker competition={competition} className={breadcrumbTrigger} />
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

// The camera mark from apps/web/public/blikka-logo.svg, in the text color: Ink on light, Paper on dark.
function BlikkaMark({ className }: { className?: string }) {
  return (
    <svg role="img" aria-label="Blikka" viewBox="0 0 358 299" fill="currentColor" className={className}>
      <rect width="122" height="299" rx="51" />
      <rect x="142" width="216" height="89" rx="37" />
      <path d="M301 109C332.48 109 358 134.52 358 166V242C358 273.48 332.48 299 301 299H199C167.52 299 142 273.48 142 242V166C142 134.52 167.52 109 199 109H301ZM249.5 156C222.714 156 201 177.714 201 204.5C201 231.286 222.714 253 249.5 253C276.286 253 298 231.286 298 204.5C298 177.714 276.286 156 249.5 156Z" />
    </svg>
  );
}

function Monogram({ name, className = "size-6 text-xs" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-md bg-foreground font-semibold text-background ${className}`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function OrganizationMenuGroup({ organizationId }: { organizationId: string }) {
  const { data: organizations } = useQuery(organizationsQuery);

  return (
    <MenuGroup>
      <MenuGroupLabel>Organizations</MenuGroupLabel>
      {organizations?.map((o) => (
        <MenuItem
          key={o.id}
          className="no-underline"
          render={<Link to="/dashboard/$organizationId" params={{ organizationId: o.id }} />}
        >
          <span className="truncate">{o.name}</span>
          {o.id === organizationId && <IconCheck aria-hidden className="ms-auto" />}
        </MenuItem>
      ))}
    </MenuGroup>
  );
}

// Invitations to accept, then a new organization.
function JoinMenuGroups() {
  const { data: invitations } = useQuery(receivedInvitationsQuery);
  const accept = useMutation(acceptInvitationMutation);
  const navigate = useNavigate();

  return (
    <>
      {invitations?.length ? (
        <>
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
                  <span className="text-xs wrap-anywhere text-muted-foreground">{invitedBy(invitation)}</span>
                </span>
                <span className="ms-auto font-medium">Join</span>
              </MenuItem>
            ))}
          </MenuGroup>
          <MenuSeparator />
        </>
      ) : null}
      <MenuItem className="no-underline" render={<Link to="/onboarding" />}>
        <IconPlus aria-hidden />
        New organization
      </MenuItem>
    </>
  );
}

function AccountMenuGroups({ email }: { email: string }) {
  const signOut = useSignOut();
  const scheme = usePreference(colorScheme);

  return (
    <>
      <MenuGroup>
        <MenuGroupLabel className="wrap-anywhere">{email}</MenuGroupLabel>
      </MenuGroup>
      <MenuSeparator />
      <MenuGroup>
        <MenuGroupLabel>Theme</MenuGroupLabel>
        <MenuRadioGroup value={scheme.value} onValueChange={(value) => colorScheme.set(value)}>
          {colorScheme.values.map((value) => (
            <MenuRadioItem key={value} value={value}>
              <MenuItemIndicator />
              {value === "system" ? "System" : value === "light" ? "Light" : "Dark"}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuGroup>
      <MenuSeparator />
      <MenuItem onSelect={signOut}>Sign out</MenuItem>
    </>
  );
}
