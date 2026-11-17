import {
  IconArrowLeft,
  IconCheck,
  IconLayoutDashboard,
  IconListNumbers,
  IconSelector,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ui-sdk/react/command";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ui-sdk/react/navigation-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-sdk/react/popover";
import { type Competition, competitionsQuery } from "@/api/competitions.ts";
import { StatusBadge } from "@/components/StatusBadge.tsx";
import { byStatus, competitionStatus, type CompetitionStatus } from "@/lib/competitionStatus.ts";

const pages = [
  {
    to: "/dashboard/$organizationId/events/$competitionId",
    label: "Overview",
    icon: IconLayoutDashboard,
  },
  {
    to: "/dashboard/$organizationId/events/$competitionId/participants",
    label: "Participants",
    icon: IconUsers,
  },
  {
    to: "/dashboard/$organizationId/events/$competitionId/topics",
    label: "Topics",
    icon: IconListNumbers,
  },
  {
    to: "/dashboard/$organizationId/events/$competitionId/settings",
    label: "Settings",
    icon: IconSettings,
  },
] as const;

export const breadcrumbTrigger =
  "h-8 min-w-0 justify-start gap-2 border-transparent bg-transparent px-2 hover:bg-foreground/5 data-open:bg-foreground/5";

export const navLinkClass =
  "h-8 w-full px-2 font-normal text-muted-foreground hover:bg-foreground/5 hover:text-foreground data-current:bg-foreground/[0.07] data-current:font-medium data-current:text-foreground";

export function EventNav({ competition }: { competition: Competition }) {
  const params = { organizationId: competition.organization_id, competitionId: competition.id };
  const current = useCurrentPage(competition);

  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/dashboard/$organizationId"
        params={{ organizationId: competition.organization_id }}
        className="flex h-7 items-center gap-1.5 self-start rounded-md px-2 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <IconArrowLeft aria-hidden className="size-4" />
        Events
      </Link>
      <NavigationMenu aria-label="Event" orientation="vertical">
        <NavigationMenuList>
          {pages.map((page) => (
            <NavigationMenuItem key={page.to}>
              <NavigationMenuLink
                className={navLinkClass}
                render={<Link to={page.to} params={params} />}
                current={page === current}
              >
                <page.icon aria-hidden />
                {page.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

function useCurrentPage(competition: Competition) {
  const matchRoute = useMatchRoute();
  const params = { organizationId: competition.organization_id, competitionId: competition.id };

  return pages.find((page) => matchRoute({ to: page.to, params })) ?? pages[0];
}

export function EventPicker({ competition, className }: { competition: Competition; className: string }) {
  const page = useCurrentPage(competition);
  const { data: competitions = [] } = useQuery(competitionsQuery(competition.organization_id));
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const sorted = byStatus(competitions);
  const ongoing = sorted.filter((c) => competitionStatus(c) !== "Ended");
  const ended = sorted.filter((c) => competitionStatus(c) === "Ended");

  const option = (c: Competition) => (
    <CommandItem key={c.id} value={c.id} label={c.name}>
      <span className="truncate">{c.name}</span>
      {c.id === competition.id ? (
        <IconCheck aria-hidden className="ms-auto" />
      ) : (
        <Status status={competitionStatus(c)} className="ms-auto" />
      )}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={`${competition.name}, switch event`} className={className}>
        <span className="truncate font-medium">{competition.name}</span>
        <StatusBadge status={competitionStatus(competition)} />
        <IconSelector aria-hidden className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command
          onAction={(value) => {
            setOpen(false);
            void navigate({
              to: page.to,
              params: { organizationId: competition.organization_id, competitionId: value },
            });
          }}
        >
          <CommandInput aria-label="Find an event" placeholder="Find an event" />
          <CommandEmpty>No events match.</CommandEmpty>
          <CommandList className="max-h-80">
            {ongoing.length > 0 && (
              <CommandGroup>
                <CommandGroupLabel>Current</CommandGroupLabel>
                {ongoing.map(option)}
              </CommandGroup>
            )}
            {ended.length > 0 && (
              <CommandGroup>
                <CommandGroupLabel>Ended</CommandGroupLabel>
                {ended.map(option)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Status({ status, className = "" }: { status: CompetitionStatus; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground ${className}`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${status === "Live" ? "bg-safelight" : status === "Upcoming" ? "bg-blue-hour" : status === "Draft" ? "border border-muted-foreground" : "bg-muted-foreground"}`}
      />
      {status}
    </span>
  );
}
