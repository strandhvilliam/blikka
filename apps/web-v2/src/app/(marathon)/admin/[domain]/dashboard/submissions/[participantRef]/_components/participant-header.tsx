"use client"

import {
  AlertTriangle,
  ArrowLeft,
  Badge,
  Camera,
  CheckCircle,
  Mail,
  Smartphone,
  XCircle,
  Zap,
} from "lucide-react"
import type {
  CompetitionClass,
  DeviceGroup,
  Participant,
  Submission,
  ValidationResult,
  ZippedSubmission,
} from "@blikka/db"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"
import { useParams } from "next/navigation"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function DeviceIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "smartphone":
      return <Smartphone className="h-5 w-5" />
    case "action-camera":
      return <Zap className="h-5 w-5" />
    default:
      return <Camera className="h-5 w-5" />
  }
}

export function ParticipantHeader() {
  const { domain, participantRef } = useParams<{ domain: string; participantRef: string }>()
  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    })
  )

  const globalValidations = participant.validationResults.filter((result) => !result.fileName)

  //   const { execute: getPresignedExportUrl, status: exportStatus } = useAction(
  //     getPresignedExportUrlAction,
  //     {
  //       onSuccess: ({ data }) => {
  //         if (!data?.url) {
  //           toast.error("No download URL returned")
  //           return
  //         }
  //         const link = document.createElement("a")
  //         link.href = data.url
  //         link.download = "submission.zip"
  //         document.body.appendChild(link)
  //         link.click()
  //         document.body.removeChild(link)
  //       },
  //       onError: () => {
  //         toast.error("Failed to get download URL")
  //       },
  //     }
  //   )

  const submissionsNeedingThumbnails =
    participant.submissions?.filter(
      (submission) => !submission.thumbnailKey || !submission.previewKey
    ) || []

  const shouldShowThumbnailGeneration =
    (participant.status === "completed" || participant.status === "verified") &&
    submissionsNeedingThumbnails.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ParticipantHeaderInfo participant={participant} globalValidations={globalValidations} />
        {/* <ParticipantActionButtons
          participant={participant}
          exportStatus={exportStatus}
          getPresignedExportUrl={getPresignedExportUrl}
        /> */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* <ParticipantStatusCard
          participant={participant}
          handleOpenVerifyDialog={() => setIsVerifyDialogOpen(true)}
        /> */}
        <ParticipantCompetitionClassCard competitionClass={participant.competitionClass} />
        <ParticipantDeviceGroupCard deviceGroup={participant.deviceGroup} />
        {/* <ParticipantExportCard participant={participant} />
        <ParticipantThumbnailGenerationCard
          shouldShow={shouldShowThumbnailGeneration}
          submissionsNeedingThumbnails={submissionsNeedingThumbnails}
          variantsGeneratorUrl={variantsGeneratorUrl}
        /> */}
      </div>
      {/* <ParticipantVerifyDialog
        isOpen={isVerifyDialogOpen}
        onOpenChange={setIsVerifyDialogOpen}
        participant={participant}
      /> */}
    </div>
  )
}

function ParticipantHeaderInfo({
  participant,
  globalValidations,
}: {
  participant: Participant
  globalValidations: ValidationResult[]
}) {
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
        <Link href={`/admin/submissions`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex flex-col gap-0">
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

function ParticipantCompetitionClassCard({
  competitionClass,
}: {
  competitionClass: CompetitionClass | null
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow items-center flex">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-5 h-5 text-center text-sm font-bold font-mono flex items-center justify-center">
                    {competitionClass?.numberOfPhotos || "?"}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of photos required: {competitionClass?.numberOfPhotos || "Unknown"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              <span className="font-normal text-muted-foreground">Class:</span>{" "}
              {competitionClass?.name || "No class assigned"}
            </h3>
            {competitionClass?.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {competitionClass.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ParticipantDeviceGroupCard({ deviceGroup }: { deviceGroup: DeviceGroup | null }) {
  return (
    <Card className="hover:shadow-sm transition-shadow items-center flex">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    {deviceGroup ? (
                      <DeviceIcon icon={deviceGroup.icon} />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Device type: {deviceGroup?.icon || "Unknown"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              <span className="font-normal text-muted-foreground">Device:</span>{" "}
              {deviceGroup?.name || "No device group"}
            </h3>
            {deviceGroup?.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {deviceGroup.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
