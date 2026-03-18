"use client"

import Link from "next/link"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  BookOpen,
  File,
  Heart,
  Images,
  ListCheck,
  Settings,
  Shield,
  Tag,
  Trophy,
  Vote,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn, formatDomainPathname } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"

type NavCard = {
  name: string
  url: string
  icon: LucideIcon
  description: string
  accent: string
  accentBorder: string
}

const MARATHON_CARDS: NavCard[] = [
  {
    name: "Submissions",
    url: "/dashboard/submissions",
    icon: Images,
    description:
      "Review incoming photo uploads, verify participants, and manage the submission queue for your event.",
    accent: "bg-sky-50",
    accentBorder: "border-sky-200/70",
  },
  {
    name: "Export",
    url: "/dashboard/export",
    icon: File,
    description:
      "Download contact sheets, participant lists, and photo archives ready for print or sharing.",
    accent: "bg-violet-50",
    accentBorder: "border-violet-200/70",
  },
  {
    name: "Staff",
    url: "/dashboard/staff",
    icon: Shield,
    description:
      "Invite team members who can help verify submissions and manage the event alongside you.",
    accent: "bg-emerald-50",
    accentBorder: "border-emerald-200/70",
  },
  {
    name: "Jury",
    url: "/dashboard/jury",
    icon: Trophy,
    description:
      "Set up jury members with scoring links. They can review and rank entries from any device.",
    accent: "bg-amber-50",
    accentBorder: "border-amber-200/70",
  },
  {
    name: "Voting",
    url: "/dashboard/voting",
    icon: Vote,
    description:
      "Create voting sessions, track progress, and view live results as jury scores come in.",
    accent: "bg-rose-50",
    accentBorder: "border-rose-200/70",
  },
]

const CONFIGURATION_CARDS: NavCard[] = [
  {
    name: "Topics",
    url: "/dashboard/topics",
    icon: Tag,
    description:
      "Define the photo themes participants will respond to. Control activation, scheduling, and order.",
    accent: "bg-teal-50",
    accentBorder: "border-teal-200/70",
  },
  {
    name: "Classes",
    url: "/dashboard/classes",
    icon: ListCheck,
    description:
      "Organize participants into competition classes and device groups for fair judging.",
    accent: "bg-indigo-50",
    accentBorder: "border-indigo-200/70",
  },
  {
    name: "Rules",
    url: "/dashboard/rules",
    icon: BookOpen,
    description:
      "Set validation rules for uploads — file formats, image dimensions, deadlines, and more.",
    accent: "bg-orange-50",
    accentBorder: "border-orange-200/70",
  },
  {
    name: "Sponsors",
    url: "/dashboard/sponsors",
    icon: Heart,
    description:
      "Add sponsor logos that appear in the participant flow. A simple way to give partners visibility.",
    accent: "bg-pink-50",
    accentBorder: "border-pink-200/70",
  },
  {
    name: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
    description:
      "Configure event dates, branding, participant flow mode, and other core marathon settings.",
    accent: "bg-slate-50",
    accentBorder: "border-slate-200/70",
  },
]

function NavigationCard({ card, domain }: { card: NavCard; domain: string }) {
  const Icon = card.icon
  const href = formatDomainPathname(`/admin${card.url}`, domain)

  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-border/60 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300",
            card.accent,
            card.accentBorder,
          )}
        >
          <Icon className="h-5 w-5 text-foreground/70" />
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground/60" />
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {card.name}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {card.description}
        </p>
      </div>
    </Link>
  )
}

export function DashboardHomeContent() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-2 md:px-10">
      <header className="mb-12 max-w-2xl md:mb-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-primary">
          {marathon.name}
        </p>
        <h1 className="font-gothic text-3xl font-normal tracking-tight text-foreground md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
          Welcome to your event dashboard
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          Everything you need to run your photo event lives here. Choose a
          section below to get started — from reviewing submissions to
          configuring the rules of your competition.
        </p>
      </header>

      <section className="mb-14 md:mb-16">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Run your event
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MARATHON_CARDS.map((card) => (
            <NavigationCard key={card.url} card={card} domain={domain} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Configure your event
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIGURATION_CARDS.map((card) => (
            <NavigationCard key={card.url} card={card} domain={domain} />
          ))}
        </div>
      </section>
    </div>
  )
}
