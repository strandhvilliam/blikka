"use client"

import Link from "next/link"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { RouterOutputs } from "@blikka/api/trpc"
import { format, formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Images,
  Settings,
  Shield,
  Tag,
  Trophy,
  Users,
  Vote,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatDomainPathname } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMarathonConfiguration } from "@/hooks/use-marathon-configuration"
import { useMarathonCountdown } from "@/hooks/use-marathon-countdown"
import { useByCameraLifecycle, type ByCameraPhase } from "../_hooks/use-by-camera-lifecycle"

type OverviewCardProps = {
  eyebrow: string
  title: string
  description: string
  accent?: "default" | "warm" | "success"
  children?: React.ReactNode
}

type StatCardProps = {
  label: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
}

type ActionItem = {
  label: string
  description: string
  href: string
}

type ActivityItem = {
  title: string
  description: string
  href: string
  at: string
  tone?: "default" | "warning" | "success"
}

type DashboardOverviewData = RouterOutputs["participants"]["getDashboardOverview"]
type MarathonData = RouterOutputs["marathons"]["getByDomain"]
type JuryInvitationsData = RouterOutputs["jury"]["getJuryInvitationsByDomain"]
type ActiveTopic = MarathonData["topics"][number]

const MARATHON_STATUS_META = {
  "not-setup": {
    label: "Setup incomplete",
    description: "Finish the missing setup items before the event can go live.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  upcoming: {
    label: "Upcoming",
    description: "The marathon has not started yet.",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
  },
  live: {
    label: "Live",
    description: "Participants can actively move through the marathon flow right now.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  ended: {
    label: "Ended",
    description: "The event window has closed. Focus on review, export, and follow-up.",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
  },
} as const

const BY_CAMERA_PHASE_META: Record<
  ByCameraPhase,
  {
    label: string
    description: string
    badgeClass: string
  }
> = {
  "no-active-topic": {
    label: "No active topic",
    description: "Nothing is live until a topic is activated.",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
  },
  "submissions-not-started": {
    label: "Topic queued",
    description: "The active topic is ready, but the submission window has not opened yet.",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
  },
  "submissions-ongoing": {
    label: "Collecting submissions",
    description: "Participants are uploading for the current topic right now.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  "submissions-ended": {
    label: "Submission window closed",
    description: "Submissions are done for the active topic. Voting is the next step.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  "voting-ongoing": {
    label: "Voting live",
    description: "Voting sessions are in progress for the active topic.",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
  },
  "voting-ended": {
    label: "Voting ended",
    description: "Results are ready to review for the active topic.",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
  },
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set"
  return format(new Date(value), "MMM d, HH:mm")
}

function getParticipantStatusLabel(status: string) {
  switch (status) {
    case "prepared":
      return "Registration saved"
    case "initialized":
      return "Participant initialized"
    case "completed":
      return "Upload completed"
    case "verified":
      return "Verified by staff"
    default:
      return status
  }
}

function OverviewCard({
  eyebrow,
  title,
  description,
  accent = "default",
  children,
}: OverviewCardProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-card/95",
        accent === "warm" && "border-amber-200/70 bg-amber-50/50",
        accent === "success" && "border-emerald-200/70 bg-emerald-50/50",
      )}
    >
      <CardHeader className="gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </div>
        <div className="space-y-1">
          <CardTitle className="font-gothic text-2xl font-medium tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      {children ? <CardContent className="pt-1 pb-5">{children}</CardContent> : null}
    </Card>
  )
}

function StatCard({ label, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardContent className="flex items-start justify-between gap-4 py-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-gothic text-3xl font-medium tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-muted/60 p-2.5">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader>
        <CardTitle className="font-gothic text-2xl font-medium tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-5">{children}</CardContent>
    </Card>
  )
}

function ActionList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-5 text-sm text-muted-foreground">
        No urgent actions right now.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href}
          className="group flex items-start justify-between gap-4 rounded-xl border border-border/80 bg-background/70 px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <div className="space-y-1">
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-sm text-muted-foreground">{item.description}</div>
          </div>
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  )
}

function Checklist({ items }: { items: ActionItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href}
          className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <div className="mt-0.5 rounded-full border border-amber-200 bg-amber-50 p-1">
            <AlertTriangle className="size-3.5 text-amber-700" />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-sm text-muted-foreground">{item.description}</div>
          </div>
        </Link>
      ))}

      {items.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="size-4" />
            Core setup is complete
          </div>
          <p className="mt-1 text-sm text-emerald-800/80">
            Dates, classes, device groups, and topics are in place.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-5 text-sm text-muted-foreground">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.title}-${item.at}`}
          href={item.href}
          className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <div
            className={cn(
              "mt-1 size-2 rounded-full bg-slate-400",
              item.tone === "warning" && "bg-amber-500",
              item.tone === "success" && "bg-emerald-500",
            )}
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{item.description}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function QuickActions({
  actions,
}: {
  actions: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string }> }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Button key={action.href} asChild variant="outline" className="justify-between">
            <Link href={action.href}>
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4" />
                {action.label}
              </span>
              <ArrowRight className="size-4 opacity-60" />
            </Link>
          </Button>
        )
      })}
    </div>
  )
}

function buildChecklistItems(
  requiredActions: Array<{ action: string; description: string }>,
  domain: string,
) {
  return requiredActions.map((item) => {
    let href = formatDomainPathname("/admin/dashboard/settings", domain)

    if (item.action === "missing_device_groups" || item.action === "missing_competition_classes") {
      href = formatDomainPathname("/admin/dashboard/classes", domain)
    }

    if (item.action === "missing_topics" || item.action === "missing_competition_class_topics") {
      href = formatDomainPathname("/admin/dashboard/topics", domain)
    }

    return {
      label: item.description,
      description: "Open the relevant setup section",
      href,
    }
  })
}

function DashboardShell({
  title,
  description,
  hero,
  stats,
  attention,
  checklist,
  quickActions,
  secondary,
  activity,
}: {
  title: string
  description: string
  hero: React.ReactNode
  stats: React.ReactNode
  attention: React.ReactNode
  checklist: React.ReactNode
  quickActions: React.ReactNode
  secondary: React.ReactNode
  activity: React.ReactNode
}) {
  return (
    <div className="container mx-auto flex h-full max-w-7xl flex-col space-y-6 pb-8">
      <section className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-gothic text-4xl font-medium tracking-tight">Dashboard</h1>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
            Overview
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">{hero}</section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats}</section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <SectionCard title="Attention Needed" description={title}>
            {attention}
          </SectionCard>
          <SectionCard title="Recent Activity" description="Latest participant, topic, and jury events.">
            {activity}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Setup Checklist" description="Resolve blockers and keep the admin side in shape.">
            {checklist}
          </SectionCard>
          <SectionCard title="Quick Actions" description="Jump directly into the most common admin tasks.">
            {quickActions}
          </SectionCard>
          <SectionCard title="Team & Support" description="Who is ready around the event.">
            {secondary}
          </SectionCard>
        </div>
      </section>
    </div>
  )
}

function MarathonDashboard() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: overview } = useSuspenseQuery(
    trpc.participants.getDashboardOverview.queryOptions({ domain }),
  )
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  const { data: staffMembers } = useSuspenseQuery(
    trpc.users.getStaffMembersByDomain.queryOptions({ domain }),
  )
  const { data: juryInvitations } = useSuspenseQuery(
    trpc.jury.getJuryInvitationsByDomain.queryOptions({ domain }),
  )
  const { requiredActions } = useMarathonConfiguration(domain)
  const { countdown, status } = useMarathonCountdown(domain)

  const statusMeta = MARATHON_STATUS_META[status]
  const checklistItems = buildChecklistItems(requiredActions, domain)
  const pendingJury = juryInvitations.filter((item) => item.status !== "completed").length

  const attentionItems: ActionItem[] = [
    ...checklistItems,
    ...(overview.statusCounts.completed > 0
      ? [
          {
            label: `${overview.statusCounts.completed} participants waiting for verification`,
            description: "Open the submissions desk and clear the review queue.",
            href: formatDomainPathname("/admin/dashboard/submissions?tab=not-verified", domain),
          },
        ]
      : []),
    ...(overview.validationIssueCount > 0
      ? [
          {
            label: `${overview.validationIssueCount} participants with validation issues`,
            description: "Review failed or warning-level validation results.",
            href: formatDomainPathname("/admin/dashboard/submissions?tab=validation-errors", domain),
          },
        ]
      : []),
    ...(staffMembers.length === 0
      ? [
          {
            label: "No staff members added yet",
            description: "Invite at least one person to handle verification.",
            href: formatDomainPathname("/admin/dashboard/staff", domain),
          },
        ]
      : []),
  ]

  const activities: ActivityItem[] = [
    ...overview.recentParticipants.map((participant) => ({
      title: `${participant.firstname} ${participant.lastname} (#${participant.reference})`,
      description:
        participant.validationIssueCount > 0
          ? `${getParticipantStatusLabel(participant.status)} with ${participant.validationIssueCount} validation issue${participant.validationIssueCount === 1 ? "" : "s"}`
          : getParticipantStatusLabel(participant.status),
      href: formatDomainPathname(`/admin/dashboard/submissions/${participant.reference}`, domain),
      at: participant.updatedAt,
      tone:
        participant.validationIssueCount > 0
          ? ("warning" as ActivityItem["tone"])
          : participant.status === "verified"
            ? ("success" as ActivityItem["tone"])
            : ("default" as ActivityItem["tone"]),
    })),
    ...marathon.topics
      .filter((topic) => topic.activatedAt)
      .slice()
      .sort((left, right) => new Date(right.activatedAt ?? 0).getTime() - new Date(left.activatedAt ?? 0).getTime())
      .slice(0, 2)
      .map((topic) => ({
        title: `Topic ${topic.orderIndex + 1} activated`,
        description: topic.name,
        href: formatDomainPathname("/admin/dashboard/topics", domain),
        at: topic.activatedAt ?? topic.createdAt,
        tone: "success" as const,
      })),
    ...juryInvitations
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 2)
      .map((invitation) => ({
        title: `Jury invite sent to ${invitation.displayName}`,
        description: invitation.status === "completed" ? "Completed jury review" : "Awaiting jury progress",
        href: formatDomainPathname(`/admin/dashboard/jury/${invitation.id}`, domain),
        at: invitation.createdAt,
        tone: invitation.status === "completed" ? ("success" as const) : ("default" as const),
      })),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 6)

  return (
    <DashboardShell
      title="Fix blockers, process uploads, and keep the event moving."
      description="Use the dashboard as the control room for marathon-mode events: setup, participant flow, verification, and team readiness all in one place."
      hero={
        <>
          <OverviewCard
            eyebrow="Current state"
            title={statusMeta.label}
            description={statusMeta.description}
            accent={status === "live" ? "success" : status === "not-setup" ? "warm" : "default"}
          >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/80 px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Countdown</div>
                <div className="mt-1 font-mono text-xl font-semibold">{countdown}</div>
              </div>
              <Badge className={cn("rounded-full border px-3 py-1", statusMeta.badgeClass)}>
                {statusMeta.label}
              </Badge>
            </div>
          </OverviewCard>

          <OverviewCard
            eyebrow="Schedule"
            title={`${formatDateTime(marathon.startDate)} to ${formatDateTime(marathon.endDate)}`}
            description="The public marathon window drives when the live flow is open."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Start</div>
                <div className="mt-1 text-sm font-medium">{formatDateTime(marathon.startDate)}</div>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">End</div>
                <div className="mt-1 text-sm font-medium">{formatDateTime(marathon.endDate)}</div>
              </div>
            </div>
          </OverviewCard>

          <OverviewCard
            eyebrow="Next step"
            title={requiredActions.length > 0 ? "Finish setup" : "Work the review queue"}
            description={
              requiredActions.length > 0
                ? "There are still setup blockers before the event is fully ready."
                : overview.statusCounts.completed > 0
                  ? "Participants are waiting for staff verification."
                  : "Core operations look healthy right now."
            }
            accent={requiredActions.length > 0 ? "warm" : "default"}
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                {requiredActions.length > 0
                  ? `${requiredActions.length} setup item${requiredActions.length === 1 ? "" : "s"} still need attention.`
                  : overview.statusCounts.completed > 0
                    ? `${overview.statusCounts.completed} uploaded participant${overview.statusCounts.completed === 1 ? "" : "s"} are ready to review.`
                    : "No blocking work is currently at the top of the queue."}
              </div>
              <Button asChild className="w-full justify-between">
                <Link
                  href={
                    requiredActions.length > 0
                      ? (checklistItems[0]?.href ?? formatDomainPathname("/admin/dashboard/settings", domain))
                      : formatDomainPathname("/admin/dashboard/submissions?tab=not-verified", domain)
                  }
                >
                  <span>{requiredActions.length > 0 ? "Open setup" : "Open submissions"}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </OverviewCard>
        </>
      }
      stats={
        <>
          <StatCard
            label="Participants"
            value={overview.totalParticipants}
            description="Total registered for this marathon."
            icon={Users}
          />
          <StatCard
            label="Uploaded"
            value={overview.uploadedCount}
            description="Participants who finished the upload step."
            icon={Images}
          />
          <StatCard
            label="Verified"
            value={overview.statusCounts.verified}
            description="Participants cleared by staff review."
            icon={ClipboardCheck}
          />
          <StatCard
            label="Validation flags"
            value={overview.validationIssueCount}
            description="Participants with failed or warning validations."
            icon={AlertTriangle}
          />
        </>
      }
      attention={<ActionList items={attentionItems.slice(0, 5)} />}
      checklist={<Checklist items={checklistItems} />}
      quickActions={
        <QuickActions
          actions={[
            {
              label: "Review submissions",
              href: formatDomainPathname("/admin/dashboard/submissions", domain),
              icon: Images,
            },
            {
              label: "Configure settings",
              href: formatDomainPathname("/admin/dashboard/settings", domain),
              icon: Settings,
            },
            {
              label: "Manage staff",
              href: formatDomainPathname("/admin/dashboard/staff", domain),
              icon: Shield,
            },
            {
              label: "Open jury",
              href: formatDomainPathname("/admin/dashboard/jury", domain),
              icon: Trophy,
            },
          ]}
        />
      }
      secondary={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Staff members</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {staffMembers.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {staffMembers.filter((member) => member.role === "admin").length} admin
              {staffMembers.filter((member) => member.role === "admin").length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Jury invitations</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {juryInvitations.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {pendingJury} pending, {juryInvitations.length - pendingJury} completed
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Classes</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {marathon.competitionClasses.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {marathon.deviceGroups.length} device groups configured
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Sponsors</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {marathon.sponsors.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Visible in the participant flow</div>
          </div>
        </div>
      }
      activity={<ActivityFeed items={activities} />}
    />
  )
}

function ByCameraDashboard() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: overview } = useSuspenseQuery(
    trpc.participants.getDashboardOverview.queryOptions({ domain }),
  )
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  const { data: staffMembers } = useSuspenseQuery(
    trpc.users.getStaffMembersByDomain.queryOptions({ domain }),
  )
  const { data: juryInvitations } = useSuspenseQuery(
    trpc.jury.getJuryInvitationsByDomain.queryOptions({ domain }),
  )
  const { requiredActions } = useMarathonConfiguration(domain)

  const activeTopic = marathon.topics.find((topic) => topic.visibility === "active") ?? null
  const phase = useByCameraLifecycle(activeTopic)
  const phaseMeta = BY_CAMERA_PHASE_META[phase]
  const checklistItems = buildChecklistItems(requiredActions, domain)

  if (!activeTopic) {
    const activities: ActivityItem[] = marathon.topics
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 6)
      .map((topic) => ({
        title: `Topic ${topic.orderIndex + 1}`,
        description: `${topic.name} is ${topic.visibility}.`,
        href: formatDomainPathname("/admin/dashboard/topics", domain),
        at: topic.createdAt,
      }))

    return (
      <DashboardShell
        title="Activate a topic to start the by-camera flow."
        description="By-camera mode is driven by the active topic lifecycle. Use the dashboard to monitor topic readiness, current windows, and voting progress."
        hero={
          <>
            <OverviewCard eyebrow="Current state" title={phaseMeta.label} description={phaseMeta.description}>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/80 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  No topic is active. Submissions and voting are idle.
                </div>
                <Badge className={cn("rounded-full border px-3 py-1", phaseMeta.badgeClass)}>
                  Waiting
                </Badge>
              </div>
            </OverviewCard>
            <OverviewCard eyebrow="Topics" title={`${marathon.topics.length} configured`} description="Build the queue and activate the next topic when ready.">
              <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                {marathon.topics.length === 0
                  ? "No topics exist yet."
                  : `${marathon.topics.filter((topic) => topic.visibility === "scheduled").length} topic${marathon.topics.filter((topic) => topic.visibility === "scheduled").length === 1 ? "" : "s"} are scheduled next.`}
              </div>
            </OverviewCard>
            <OverviewCard eyebrow="Next step" title="Activate a topic" description="Nothing reaches participants until a topic is active." accent="warm">
              <Button asChild className="w-full justify-between">
                <Link href={formatDomainPathname("/admin/dashboard/topics", domain)}>
                  <span>Open topics</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </OverviewCard>
          </>
        }
        stats={
          <>
            <StatCard label="Topics" value={marathon.topics.length} description="Topics configured for this event." icon={Tag} />
            <StatCard label="Participants" value={overview.totalParticipants} description="Participants registered overall." icon={Users} />
            <StatCard label="Staff" value={staffMembers.length} description="People ready to help manage the flow." icon={Shield} />
            <StatCard label="Validation flags" value={overview.validationIssueCount} description="Participants with failed or warning validations." icon={AlertTriangle} />
          </>
        }
        attention={
          <ActionList
            items={[
              ...checklistItems,
              {
                label: "No active topic",
                description: "Activate a topic before submissions can begin.",
                href: formatDomainPathname("/admin/dashboard/topics", domain),
              },
            ]}
          />
        }
        checklist={<Checklist items={checklistItems} />}
        quickActions={
          <QuickActions
            actions={[
              {
                label: "Manage topics",
                href: formatDomainPathname("/admin/dashboard/topics", domain),
                icon: Tag,
              },
              {
                label: "Review submissions",
                href: formatDomainPathname("/admin/dashboard/submissions", domain),
                icon: Images,
              },
              {
                label: "Open voting",
                href: formatDomainPathname("/admin/dashboard/voting", domain),
                icon: Vote,
              },
              {
                label: "Configure rules",
                href: formatDomainPathname("/admin/dashboard/rules", domain),
                icon: Settings,
              },
            ]}
          />
        }
        secondary={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
              <div className="text-sm text-muted-foreground">Jury invitations</div>
              <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
                {juryInvitations.length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Ready for post-event review</div>
            </div>
            <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
              <div className="text-sm text-muted-foreground">Sponsors</div>
              <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
                {marathon.sponsors.length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Shown inside the live participant experience</div>
            </div>
          </div>
        }
        activity={<ActivityFeed items={activities} />}
      />
    )
  }

  return (
    <ByCameraDashboardActiveTopic
      activeTopic={activeTopic}
      checklistItems={checklistItems}
      marathon={marathon}
      overview={overview}
      phase={phase}
      phaseMeta={phaseMeta}
      staffCount={staffMembers.length}
      juryInvitations={juryInvitations}
    />
  )
}

function ByCameraDashboardActiveTopic({
  activeTopic,
  checklistItems,
  marathon,
  overview,
  phase,
  phaseMeta,
  staffCount,
  juryInvitations,
}: {
  activeTopic: ActiveTopic
  checklistItems: ActionItem[]
  marathon: MarathonData
  overview: DashboardOverviewData
  phase: ByCameraPhase
  phaseMeta: (typeof BY_CAMERA_PHASE_META)[ByCameraPhase]
  staffCount: number
  juryInvitations: JuryInvitationsData
}) {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: votingSummary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

  const attentionItems: ActionItem[] = [
    ...checklistItems,
    ...(phase === "submissions-ongoing"
      ? [
          {
            label: "Monitor active submissions",
            description: `${votingSummary.submissionStats.submissionCount} submission${votingSummary.submissionStats.submissionCount === 1 ? "" : "s"} received for the current topic.`,
            href: formatDomainPathname("/admin/dashboard/submissions", domain),
          },
        ]
      : []),
    ...(phase === "submissions-ended"
      ? [
          {
            label: "Prepare voting",
            description: "Submissions are closed. Review the active topic before voting starts.",
            href: formatDomainPathname("/admin/dashboard/voting", domain),
          },
        ]
      : []),
    ...(phase === "voting-ongoing" && votingSummary.sessionStats.pending > 0
      ? [
          {
            label: `${votingSummary.sessionStats.pending} voting session${votingSummary.sessionStats.pending === 1 ? "" : "s"} still pending`,
            description: "Track completion and resend or create sessions if needed.",
            href: formatDomainPathname("/admin/dashboard/voting", domain),
          },
        ]
      : []),
    ...(overview.validationIssueCount > 0
      ? [
          {
            label: `${overview.validationIssueCount} participants with validation issues`,
            description: "Review warning and error-level validation results.",
            href: formatDomainPathname("/admin/dashboard/submissions?tab=validation-errors", domain),
          },
        ]
      : []),
  ]

  const activities: ActivityItem[] = [
    ...overview.recentParticipants.map((participant) => ({
      title: `${participant.firstname} ${participant.lastname} (#${participant.reference})`,
      description:
        participant.validationIssueCount > 0
          ? `${getParticipantStatusLabel(participant.status)} with ${participant.validationIssueCount} validation issue${participant.validationIssueCount === 1 ? "" : "s"}`
          : getParticipantStatusLabel(participant.status),
      href: formatDomainPathname(`/admin/dashboard/submissions/${participant.reference}`, domain),
      at: participant.updatedAt,
      tone:
        participant.validationIssueCount > 0
          ? ("warning" as ActivityItem["tone"])
          : participant.status === "verified"
            ? ("success" as ActivityItem["tone"])
            : ("default" as ActivityItem["tone"]),
    })),
    {
      title: `Topic ${activeTopic.orderIndex + 1} is active`,
      description: activeTopic.name,
      href: formatDomainPathname("/admin/dashboard/topics", domain),
      at: activeTopic.activatedAt ?? activeTopic.createdAt,
      tone: "success" as ActivityItem["tone"],
    },
    ...juryInvitations
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 2)
      .map((invitation) => ({
        title: `Jury invite sent to ${invitation.displayName}`,
        description: invitation.status === "completed" ? "Completed jury review" : "Awaiting jury progress",
        href: formatDomainPathname(`/admin/dashboard/jury/${invitation.id}`, domain),
        at: invitation.createdAt,
        tone: invitation.status === "completed" ? ("success" as const) : ("default" as const),
      })),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 6)

  return (
    <DashboardShell
      title="Track the active topic, current windows, and live voting state."
      description="The dashboard adapts to by-camera mode: active topic control, submission flow, voting completion, and the key actions needed for the current phase."
      hero={
        <>
          <OverviewCard
            eyebrow="Active topic"
            title={`Topic ${activeTopic.orderIndex + 1}: ${activeTopic.name}`}
            description={phaseMeta.description}
            accent={phase === "submissions-ongoing" || phase === "voting-ongoing" ? "success" : "default"}
          >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/80 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Activated {formatDistanceToNow(new Date(activeTopic.activatedAt ?? activeTopic.createdAt), { addSuffix: true })}
              </div>
              <Badge className={cn("rounded-full border px-3 py-1", phaseMeta.badgeClass)}>
                {phaseMeta.label}
              </Badge>
            </div>
          </OverviewCard>

          <OverviewCard
            eyebrow="Windows"
            title={`${formatDateTime(activeTopic.scheduledStart)} to ${formatDateTime(activeTopic.votingEndsAt)}`}
            description="Submission and voting windows are the heartbeat of the by-camera flow."
          >
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Submissions</div>
                  <div className="mt-1 text-sm font-medium">
                    {formatDateTime(activeTopic.scheduledStart)} to {formatDateTime(activeTopic.scheduledEnd)}
                  </div>
                </div>
                <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Voting</div>
                  <div className="mt-1 text-sm font-medium">
                    {formatDateTime(activeTopic.votingStartsAt)} to {formatDateTime(activeTopic.votingEndsAt)}
                  </div>
                </div>
              </div>
            </div>
          </OverviewCard>

          <OverviewCard
            eyebrow="Next step"
            title={
              phase === "submissions-ongoing"
                ? "Review incoming submissions"
                : phase === "submissions-ended"
                  ? "Prepare voting"
                  : phase === "voting-ongoing"
                    ? "Watch completion"
                    : phase === "voting-ended"
                      ? "Review results"
                      : "Manage topic timing"
            }
            description={
              phase === "voting-ongoing"
                ? `${votingSummary.sessionStats.pending} session${votingSummary.sessionStats.pending === 1 ? "" : "s"} are still pending.`
                : phase === "submissions-ongoing"
                  ? `${votingSummary.submissionStats.submissionCount} submission${votingSummary.submissionStats.submissionCount === 1 ? "" : "s"} received so far.`
                  : "Keep the active topic aligned with the current event phase."
            }
            accent={phase === "submissions-ended" || phase === "voting-ongoing" ? "warm" : "default"}
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-border/80 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                {phase === "voting-ended"
                  ? "Voting is complete. Open the voting view to inspect the leaderboard."
                  : phase === "submissions-ended"
                    ? "Submissions are closed. Confirm the topic is ready for voting."
                    : "Use the admin tools to keep the active topic moving cleanly."}
              </div>
              <Button asChild className="w-full justify-between">
                <Link
                  href={
                    phase === "submissions-ongoing" || phase === "submissions-ended"
                      ? formatDomainPathname("/admin/dashboard/submissions", domain)
                      : formatDomainPathname("/admin/dashboard/voting", domain)
                  }
                >
                  <span>
                    {phase === "submissions-ongoing" || phase === "submissions-ended"
                      ? "Open submissions"
                      : "Open voting"}
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </OverviewCard>
        </>
      }
      stats={
        <>
          <StatCard
            label="Topic submissions"
            value={votingSummary.submissionStats.submissionCount}
            description="Total uploaded for the active topic."
            icon={Images}
          />
          <StatCard
            label="Participants with uploads"
            value={votingSummary.submissionStats.participantWithSubmissionCount}
            description="Unique participants represented in the active topic."
            icon={Users}
          />
          <StatCard
            label="Voting progress"
            value={`${votingSummary.sessionStats.completed}/${votingSummary.sessionStats.total}`}
            description="Completed sessions against the total voting queue."
            icon={Vote}
          />
          <StatCard
            label="Validation flags"
            value={overview.validationIssueCount}
            description="Participants with failed or warning validations."
            icon={AlertTriangle}
          />
        </>
      }
      attention={<ActionList items={attentionItems.slice(0, 5)} />}
      checklist={<Checklist items={checklistItems} />}
      quickActions={
        <QuickActions
          actions={[
            {
              label: "Review submissions",
              href: formatDomainPathname("/admin/dashboard/submissions", domain),
              icon: Images,
            },
            {
              label: "Open voting",
              href: formatDomainPathname("/admin/dashboard/voting", domain),
              icon: Vote,
            },
            {
              label: "Manage topics",
              href: formatDomainPathname("/admin/dashboard/topics", domain),
              icon: Tag,
            },
            {
              label: "Adjust settings",
              href: formatDomainPathname("/admin/dashboard/settings", domain),
              icon: Settings,
            },
          ]}
        />
      }
      secondary={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Topics configured</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {marathon.topics.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {marathon.topics.filter((topic) => topic.visibility === "scheduled").length} scheduled next
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Voting sessions</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {votingSummary.sessionStats.total}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {votingSummary.sessionStats.pending} pending, {votingSummary.sessionStats.manualSessions} manual
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Staff members</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">{staffCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">Ready to help run the event</div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-4">
            <div className="text-sm text-muted-foreground">Jury invitations</div>
            <div className="mt-1 font-gothic text-3xl font-medium tracking-tight">
              {juryInvitations.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Prepared for post-voting review</div>
          </div>
        </div>
      }
      activity={<ActivityFeed items={activities} />}
    />
  )
}

export function DashboardHomeContent() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  if (marathon.mode === "by-camera") {
    return <ByCameraDashboard />
  }

  return <MarathonDashboard />
}
