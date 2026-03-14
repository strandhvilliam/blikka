"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Grid2x2 } from "lucide-react"
import Link from "next/link"
import type { Submission, Topic } from "@blikka/db"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"

interface SubmissionNavigationControlsProps {
  currentIndex: number
  totalSubmissions: number
  allSubmissions: (Submission & { topic: Topic | null })[]
  participantRef: string
}

export function SubmissionNavigationControls({
  currentIndex,
  totalSubmissions,
  allSubmissions,
  participantRef,
}: SubmissionNavigationControlsProps) {
  const domain = useDomain()
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < totalSubmissions - 1

  const previousSubmission = hasPrevious ? allSubmissions[currentIndex - 1] : null
  const nextSubmission = hasNext ? allSubmissions[currentIndex + 1] : null

  return (
    <div className="flex items-center justify-between mb-4">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrevious}
        asChild={hasPrevious}
        className="gap-2"
      >
        {hasPrevious ? (
          <Link
            href={formatDomainPathname(
              `/admin/dashboard/submissions/${participantRef}/${previousSubmission?.id}`,
              domain,
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </>
        )}
      </Button>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Grid2x2 className="h-4 w-4" />
              <span className="font-mono">
                {currentIndex + 1} / {totalSubmissions}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-[400px] overflow-y-auto">
            {allSubmissions.map((sub, idx) => (
              <DropdownMenuItem key={sub.id} asChild>
                <Link
                  href={formatDomainPathname(
                    `/admin/dashboard/submissions/${participantRef}/${sub.id}`,
                    domain,
                  )}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Badge
                    variant={idx === currentIndex ? "default" : "outline"}
                    className="font-mono w-12 justify-center"
                  >
                    #{(sub.topic?.orderIndex ?? 0) + 1}
                  </Badge>
                  <span className={idx === currentIndex ? "font-semibold" : ""}>
                    {sub.topic?.name || "Untitled"}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button variant="outline" size="sm" disabled={!hasNext} asChild={hasNext} className="gap-2">
        {hasNext ? (
          <Link
            href={formatDomainPathname(
              `/admin/dashboard/submissions/${participantRef}/${nextSubmission?.id}`,
              domain,
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <>
            Next
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  )
}
