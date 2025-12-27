"use client"

import { Camera, Smartphone, Zap } from "lucide-react"
import type {
  CompetitionClass,
  DeviceGroup,
  Participant,
  Submission,
  ValidationResult,
  ZippedSubmission,
} from "@vimmer/api/db/types"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vimmer/ui/components/tooltip"
import { Card, CardContent } from "@vimmer/ui/components/card"
import { toast } from "sonner"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { useState } from "react"
import { useAction } from "next-safe-action/hooks"
import { getPresignedExportUrlAction } from "@/actions/get-presigned-photo-archives-action"
import { ParticipantVerifyDialog } from "@/components/admin/participant-verify-dialog"
import { ParticipantActionButtons } from "@/components/admin/participant-action-buttons"
import { ParticipantHeaderInfo } from "@/components/admin/participant-header-info"
import { ParticipantThumbnailGenerationCard } from "@/components/admin/participant-thumbnail-generation-card"
import { ParticipantExportCard } from "@/components/admin/participant-export-card"
import { ParticipantStatusCard } from "./participant-status-card"

interface ParticipantHeaderProps {
  variantsGeneratorUrl: string
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
    submissions?: Submission[]
    zippedSubmissions?: ZippedSubmission[]
  }
  validationResults?: ValidationResult[]
}

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

interface ParticipantCompetitionClassCardProps {
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
    submissions?: Submission[]
  }
}

function ParticipantCompetitionClassCard({ participant }: ParticipantCompetitionClassCardProps) {
  return (
    <Card className="hover:shadow-sm transition-shadow items-center flex">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-5 h-5 text-center text-sm font-bold font-mono flex items-center justify-center">
                    {participant.competitionClass?.numberOfPhotos || "?"}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Number of photos required:{" "}
                    {participant.competitionClass?.numberOfPhotos || "Unknown"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              <span className="font-normal text-muted-foreground">Class:</span>{" "}
              {participant.competitionClass?.name || "No class assigned"}
            </h3>
            {participant.competitionClass?.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {participant.competitionClass.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ParticipantDeviceGroupCardProps {
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
    submissions?: Submission[]
  }
}

function ParticipantDeviceGroupCard({ participant }: ParticipantDeviceGroupCardProps) {
  return (
    <Card className="hover:shadow-sm transition-shadow items-center flex">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    {participant.deviceGroup ? (
                      <DeviceIcon icon={participant.deviceGroup.icon} />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Device type: {participant.deviceGroup?.icon || "Unknown"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              <span className="font-normal text-muted-foreground">Device:</span>{" "}
              {participant.deviceGroup?.name || "No device group"}
            </h3>
            {participant.deviceGroup?.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {participant.deviceGroup.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ParticipantHeader({
  variantsGeneratorUrl,
  participant,
  validationResults = [],
}: ParticipantHeaderProps) {
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)

  const globalValidations = validationResults.filter((result) => !result.fileName)

  const { execute: getPresignedExportUrl, status: exportStatus } = useAction(
    getPresignedExportUrlAction,
    {
      onSuccess: ({ data }) => {
        if (!data?.url) {
          toast.error("No download URL returned")
          return
        }
        const link = document.createElement("a")
        link.href = data.url
        link.download = "submission.zip"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      },
      onError: () => {
        toast.error("Failed to get download URL")
      },
    }
  )

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
        <ParticipantActionButtons
          participant={participant}
          exportStatus={exportStatus}
          getPresignedExportUrl={getPresignedExportUrl}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ParticipantStatusCard
          participant={participant}
          handleOpenVerifyDialog={() => setIsVerifyDialogOpen(true)}
        />
        <ParticipantCompetitionClassCard participant={participant} />
        <ParticipantDeviceGroupCard participant={participant} />
        <ParticipantExportCard participant={participant} />
        <ParticipantThumbnailGenerationCard
          shouldShow={shouldShowThumbnailGeneration}
          submissionsNeedingThumbnails={submissionsNeedingThumbnails}
          variantsGeneratorUrl={variantsGeneratorUrl}
        />
      </div>
      <ParticipantVerifyDialog
        isOpen={isVerifyDialogOpen}
        onOpenChange={setIsVerifyDialogOpen}
        participant={participant}
      />
    </div>
  )
}
