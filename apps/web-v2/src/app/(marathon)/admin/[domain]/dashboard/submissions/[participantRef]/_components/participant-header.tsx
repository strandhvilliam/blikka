"use client"

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Mail,
  XCircle,
  Download,
  BarChart3,
} from "lucide-react"
import type { Participant, ValidationResult } from "@blikka/db"
import { useParams } from "next/navigation"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ParticipantHeader() {
  const { domain, participantRef } = useParams<{ domain: string; participantRef: string }>()
  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    })
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ParticipantHeaderInfo participant={participant} />
        <ParticipantHeaderActions participant={participant} />
      </div>

      {/* <div className="flex flex-wrap gap-4">
        <ParticipantStatusCard status={participant.status} />
        <ParticipantCompetitionClassCard competitionClass={participant.competitionClass} />
        <ParticipantDeviceGroupCard deviceGroup={participant.deviceGroup} />
      </div> */}
    </div>
  )
}

function ParticipantHeaderInfo({
  participant,
}: {
  participant: Participant & { validationResults: ValidationResult[] }
}) {
  const { domain } = useParams<{ domain: string }>()

  const globalValidations = participant.validationResults.filter((result) => !result.fileName)
  const hasFailedValidations = globalValidations.some((result) => result.outcome === "failed")
  const hasErrors = globalValidations.some(
    (result) => result.severity === "error" && result.outcome === "failed"
  )

  const allPassed = globalValidations.length > 0 && !hasFailedValidations

  const badgeColor = allPassed
    ? "bg-green-500/15 text-green-600 hover:bg-green-500/20"
    : hasErrors
      ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
      : "bg-yellow-500/15 text-yellow-600 border-yellow-200 hover:bg-yellow-500/20"

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" asChild className="h-9 w-9">
        <Link href={`/admin/${domain}/dashboard/submissions`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight font-rocgrotesk">
            {`#${participant.reference} - `}
            {`${participant.firstname} ${participant.lastname}`}
          </h1>
          {globalValidations.length > 0 && (
            <Badge className={cn("ml-2", badgeColor)}>
              {allPassed ? (
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
              ) : hasErrors ? (
                <XCircle className="h-3.5 w-3.5 mr-1" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              )}
              {allPassed ? "Valid" : hasErrors ? "Error" : "Warning"}
            </Badge>
          )}
        </div>
        <Link
          href={`mailto:${participant.email}`}
          className="text-sm text-muted-foreground flex items-center gap-1 hover:underline"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>{participant.email}</span>
        </Link>
      </div>
    </div>
  )
}

function ParticipantHeaderActions({
  participant,
}: {
  participant: Participant & { validationResults: ValidationResult[] }
}) {
  const { domain } = useParams<{ domain: string }>()
  const trpc = useTRPC()

  const hasSubmissions =
    (participant as any).submissions && (participant as any).submissions.length > 0

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export clicked")
  }

  return (
    <div className="flex items-center gap-2">
      {hasSubmissions && (
        <Button variant="default" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4" />
            Analyze
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => console.log("Run validations")}>
            Run Validations
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log("Generate contact sheet")}>
            Generate Contact Sheet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
