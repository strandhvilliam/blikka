"use client"

import Link from "next/link"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  Gavel,
  Handshake,
  Images,
  Layers,
  QrCode,
  Settings,
  Tag,
  Users,
  Vote,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatDomainLink, formatDomainPathname } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { LiveUploadQrDialog } from "./live-upload-qr-dialog"

type NavCard = {
  name: string
  url: string
  icon: LucideIcon
  description: string
}

type EventRunCard =
  | {
      kind: "link"
      title: string
      description: string
      href: string
      icon: LucideIcon
      cta: string
      meta?: string
      attention?: boolean
    }
  | {
      kind: "button"
      title: string
      description: string
      onClick: () => void
      icon: LucideIcon
      cta: string
      meta?: string
      attention?: boolean
    }

const MARATHON_CARDS: NavCard[] = [
  {
    name: "Submissions",
    url: "/dashboard/submissions",
    icon: Images,
    description:
      "Review incoming photo uploads, verify participants, and manage the submission queue for your event.",
  },
  {
    name: "Export",
    url: "/dashboard/export",
    icon: Download,
    description:
      "Download contact sheets, participant lists, and photo archives ready for print or sharing.",
  },
  {
    name: "Staff",
    url: "/dashboard/staff",
    icon: Users,
    description:
      "Invite team members who can help verify submissions and manage the event alongside you.",
  },
  {
    name: "Jury",
    url: "/dashboard/jury",
    icon: Gavel,
    description:
      "Set up jury members with scoring links. They can review and rank entries from any device.",
  },
  {
    name: "Voting",
    url: "/dashboard/voting",
    icon: Vote,
    description:
      "Create voting sessions, track progress, and view live results as jury scores come in.",
  },
]

const CONFIGURATION_CARDS: NavCard[] = [
  {
    name: "Topics",
    url: "/dashboard/topics",
    icon: Tag,
    description:
      "Define the photo themes participants will respond to. Control activation, scheduling, and order.",
  },
  {
    name: "Classes",
    url: "/dashboard/classes",
    icon: Layers,
    description:
      "Organize participants into competition classes and device groups for fair judging.",
  },
  {
    name: "Rules",
    url: "/dashboard/rules",
    icon: BookOpen,
    description:
      "Set validation rules for uploads — file formats, image dimensions, deadlines, and more.",
  },
  {
    name: "Sponsors",
    url: "/dashboard/sponsors",
    icon: Handshake,
    description:
      "Add sponsor logos that appear in the participant flow. A simple way to give partners visibility.",
  },
  {
    name: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
    description:
      "Configure event dates, branding, participant flow mode, and other core marathon settings.",
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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 transition-colors duration-300">
          <Icon className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
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

function EventRunActionCard({ card }: { card: EventRunCard }) {
  const Icon = card.icon
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 transition-colors duration-300">
          <Icon className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        {card.attention ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            Needed
          </span>
        ) : (
          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/35" />
        )}
      </div>

      <div className="mt-5 flex min-h-36 flex-1 flex-col">
        {card.meta ? (
          <p className="mb-2 truncate text-[11px] font-semibold uppercase tracking-widest text-brand-primary">
            {card.meta}
          </p>
        ) : null}
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {card.title}
        </h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
          {card.description}
        </p>
        <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <span>{card.cta}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground/70" />
        </div>
      </div>
    </>
  )
  const className =
    "group relative flex min-h-64 flex-col rounded-2xl border border-border/60 bg-white p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  if (card.kind === "link") {
    return (
      <Link href={card.href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={card.onClick} className={className}>
      {content}
    </button>
  )
}

export function DashboardHomeContent() {
  const domain = useDomain()
  const trpc = useTRPC()
  const [qrOpen, setQrOpen] = useState(false)
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  )

  if (marathon.mode === "by-camera") {
    const topics = [...(marathon.topics ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
    const activeTopic = topics.find((topic) => topic.visibility === "active") ?? null
    const participantSiteUrl = formatDomainLink("/live", domain)
    const topicsHref = formatDomainPathname("/admin/dashboard/topics", domain)
    const submissionsHref = formatDomainPathname("/admin/dashboard/submissions", domain)
    const votingHref = formatDomainPathname("/admin/dashboard/voting", domain)
    const eventRunCards: EventRunCard[] = [
      {
        kind: "link",
        title: "Active topic",
        description: activeTopic
          ? "Participants are submitting to this topic when uploads are open. Switch topics when the next round starts."
          : "Choose the topic participants should submit photos for before sharing the upload link.",
        href: topicsHref,
        icon: Tag,
        cta: activeTopic ? "Manage active topic" : "Set active topic",
        meta: activeTopic ? `Current: ${activeTopic.name}` : "No active topic selected",
        attention: activeTopic == null,
      },
      {
        kind: "button",
        title: "Participant QR code",
        description:
          "Show the upload QR code on a screen, poster, or shared message so participants can open the live upload flow.",
        onClick: () => setQrOpen(true),
        icon: QrCode,
        cta: "Show QR code",
      },
      {
        kind: "link",
        title: "Submissions",
        description:
          "Watch incoming uploads, verify participants, and catch missing or invalid submissions while the event is running.",
        href: submissionsHref,
        icon: Images,
        cta: "Track submissions",
      },
      {
        kind: "link",
        title: "Voting",
        description:
          "Open the voting workspace when submissions are closed and the photos are ready to judge.",
        href: votingHref,
        icon: Vote,
        cta: "Open voting",
      },
    ]

    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 pt-2 sm:px-6 md:px-10">
        <header className="mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-primary">
            {marathon.name}
          </p>
          <h1 className="font-gothic text-3xl font-normal tracking-tight text-foreground md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Run your photo event
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Use this page during the event to activate topics, share the upload link, monitor
            submissions, and start voting.
          </p>
        </header>

        <div className="mb-6 inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
          <span className="truncate">
            {activeTopic ? `Current topic: ${activeTopic.name}` : "No active topic selected"}
          </span>
        </div>

        <section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {eventRunCards.map((card) => (
              <EventRunActionCard key={card.title} card={card} />
            ))}
          </div>
        </section>

        <LiveUploadQrDialog
          uploadUrl={participantSiteUrl}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 pt-2 sm:px-6 md:px-10">
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
