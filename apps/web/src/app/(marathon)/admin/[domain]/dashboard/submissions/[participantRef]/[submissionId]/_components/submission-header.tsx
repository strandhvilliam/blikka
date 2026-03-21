"use client"

import { ArrowLeft, FileText, User } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Participant } from "@blikka/db"
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
      return formatDomainPathname(`/admin/dashboard/submissions`, domain)
    }
    return formatDomainPathname(`/admin/dashboard/submissions/${participant.reference}`, domain)
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href={getBackLink()}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 shrink-0">
          <FileText className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Submission Review
          </p>
          <h1 className="text-xl font-bold tracking-tight font-gothic leading-none">
            {participant.firstname} {participant.lastname}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-[10px]">
              #{participant.reference}
            </Badge>
            <span className="text-[12px] text-muted-foreground">{participant.email}</span>
          </div>
        </div>
      </div>
      {marathonMode !== "by-camera" && (
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link
            href={formatDomainPathname(
              `/admin/dashboard/submissions/${participant.reference}`,
              domain,
            )}
          >
            <User className="h-3.5 w-3.5 mr-1.5" />
            View All Submissions
          </Link>
        </Button>
      )}
    </div>
  )
}
