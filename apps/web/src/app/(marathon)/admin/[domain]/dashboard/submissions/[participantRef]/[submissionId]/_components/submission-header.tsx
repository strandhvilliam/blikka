"use client"

import { ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Participant } from "@blikka/db"
import { Badge } from "@/components/ui/badge"
import { formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"

interface SubmissionHeaderProps {
  participant: Participant
  marathonMode?: string
  hasIssues: boolean
  submissionStatus: string
}

function SubmissionStatusChip({
  marathonMode,
  hasIssues,
  submissionStatus,
  participantStatus,
}: {
  marathonMode?: string
  hasIssues: boolean
  submissionStatus: string
  participantStatus: string
}) {
  const isByCameraMode = marathonMode === "by-camera"
  const isVerified = participantStatus === "verified"

  if (submissionStatus === "rejected") {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive shrink-0">
        Rejected
      </Badge>
    )
  }

  if (!isByCameraMode && isVerified) {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800 shrink-0">
        Verified
      </Badge>
    )
  }

  if (hasIssues) {
    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-900 shrink-0">
        Needs attention
      </Badge>
    )
  }

  if (submissionStatus === "initialized") {
    return (
      <Badge variant="outline" className="shrink-0 border-muted-foreground/25 bg-muted/50 text-muted-foreground">
        Awaiting upload
      </Badge>
    )
  }

  if (!isByCameraMode && submissionStatus === "uploaded" && !isVerified) {
    return (
      <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-900">
        Awaiting review
      </Badge>
    )
  }

  if (isByCameraMode) {
    return (
      <Badge variant="outline" className="shrink-0 border-sky-200 bg-sky-50 text-sky-900">
        Public voting
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="shrink-0 border-green-200 bg-green-50 text-green-800">
      All clear
    </Badge>
  )
}

export function SubmissionHeader({
  participant,
  marathonMode,
  hasIssues,
  submissionStatus,
}: SubmissionHeaderProps) {
  const domain = useDomain()

  const getBackLink = () => {
    if (marathonMode === "by-camera") {
      return formatDomainPathname(`/admin/dashboard/submissions`, domain)
    }
    return formatDomainPathname(`/admin/dashboard/submissions/${participant.reference}`, domain)
  }

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-0.5 h-9 w-9 shrink-0">
          <Link href={getBackLink()} aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight font-gothic sm:text-3xl">
              {participant.firstname} {participant.lastname}
            </h1>
            <SubmissionStatusChip
              marathonMode={marathonMode}
              hasIssues={hasIssues}
              submissionStatus={submissionStatus}
              participantStatus={participant.status}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Reviewing a submitted photo for this participant.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-mono text-xs">
              #{participant.reference}
            </Badge>
            <span className="truncate">{participant.email}</span>
          </div>
        </div>
      </div>
      {marathonMode !== "by-camera" && (
        <Button variant="outline" asChild className="shrink-0">
          <Link
            href={formatDomainPathname(
              `/admin/dashboard/submissions/${participant.reference}`,
              domain,
            )}
          >
            <User className="mr-2 h-4 w-4" />
            All photos
          </Link>
        </Button>
      )}
    </header>
  )
}
