"use client"

import { ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Submission, Participant, Topic, ValidationResult } from "@blikka/db"
import { Badge } from "@/components/ui/badge"
import { formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"

interface SubmissionHeaderProps {
  participant: Participant
  marathonMode?: string
}

export function SubmissionHeader({ participant, marathonMode }: SubmissionHeaderProps) {
  const domain = useDomain()

  const getBackLink = () => {
    if (marathonMode === "by-camera") {
      return formatDomainPathname(
        `/admin/dashboard/submissions`,
        domain
      )
    }
    return formatDomainPathname(
      `/admin/dashboard/submissions/${participant.reference}`,
      domain
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9">
          <Link
            href={getBackLink()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
            {participant.firstname} {participant.lastname}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono">
              #{participant.reference}
            </Badge>
            <span className="text-sm text-muted-foreground">{participant.email}</span>
          </div>
        </div>
      </div>
      {marathonMode !== "by-camera" && (
        <Button variant="outline" asChild>
          <Link
            href={formatDomainPathname(
              `/admin/dashboard/submissions/${participant.reference}`,
              domain
            )}
          >
            <User className="h-4 w-4 mr-2" />
            View All Submissions
          </Link>
        </Button>
      )}
    </div>
  )
}
