"use client"

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Mail,
  XCircle,
  Download,
  BarChart3,
  Smartphone,
  Zap,
  FileText,
  Grid3x3,
  MoreVertical,
  Image,
  Archive,
  FileImage,
  Info,
} from "lucide-react"
import type {
  Participant,
  ValidationResult,
  CompetitionClass,
  DeviceGroup,
  Submission,
} from "@blikka/db"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
import { ParticipantStatusIndicator } from "./participant-status-indicator"
import { CardContent } from "@/components/ui/card"

import { Camera } from "lucide-react"
import { useDomain } from "@/lib/domain-provider"

export function ParticipantHeader({ participantRef }: { participantRef: string }) {
  const domain = useDomain()
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

      <div className="flex flex-wrap gap-4">
        <ParticipantStatusIndicator participant={participant} />
        <ParticipantCompetitionClassCard participant={participant} />
        <ParticipantDeviceGroupCard participant={participant} />
        <ParticipantContactSheetIndicator participant={participant} />
        <ParticipantZipIndicator participant={participant} />
        <ParticipantThumbnailsIndicator participant={participant} />
        <ParticipantExifIndicator participant={participant} />
      </div>
    </div>
  )
}

function ParticipantHeaderInfo({
  participant,
}: {
  participant: Participant & { validationResults: ValidationResult[] }
}) {
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
        <Link href={`/admin/dashboard/submissions`}>
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
  participant: Participant & { validationResults: ValidationResult[]; contactSheets: any[] }
}) {
  const domain = useDomain()
  const trpc = useTRPC()

  const hasSubmissions =
    (participant as any).submissions && (participant as any).submissions.length > 0

  const hasContactSheet = participant.contactSheets && participant.contactSheets.length > 0

  const handleRunValidations = () => {
    // TODO: Implement run validations functionality
    console.log("Run validations clicked")
  }

  const handleContactSheetAction = () => {
    if (hasContactSheet) {
      // TODO: Implement download contact sheet functionality
      console.log("Download contact sheet clicked")
    } else {
      // TODO: Implement generate contact sheet functionality
      console.log("Generate contact sheet clicked")
    }
  }

  const handleRegenerateContactSheet = () => {
    // TODO: Implement regenerate contact sheet functionality
    console.log("Regenerate contact sheet clicked")
  }

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export clicked")
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleRunValidations} disabled>
        <CheckCircle className="h-4 w-4" />
        Run validations
      </Button>
      <Button variant="outline" onClick={handleContactSheetAction} disabled>
        {hasContactSheet ? (
          <>
            <Download className="h-4 w-4" />
            Download contact sheet
          </>
        ) : (
          <>
            <Grid3x3 className="h-4 w-4" />
            Generate contact sheet
          </>
        )}
      </Button>
      {hasSubmissions && (
        <Button variant="default" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleRegenerateContactSheet} disabled>
            <Grid3x3 className="h-4 w-4 mr-2" />
            Regenerate contact sheet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
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
    <div className="items-center flex rounded-lg border border-border min-w-[260px] bg-background">
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
    </div>
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
  const getDeviceIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
      case "smartphone":
        return <Smartphone className="h-5 w-5" />
      case "action-camera":
        return <Zap className="h-5 w-5" />
      default:
        return <Camera className="h-5 w-5" />
    }
  }

  return (
    <div className="items-center flex rounded-lg border border-border min-w-[260px] bg-background">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    {participant.deviceGroup ? (
                      getDeviceIcon({ icon: participant.deviceGroup.icon })
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
    </div>
  )
}

interface ParticipantContactSheetIndicatorProps {
  participant: Participant & {
    contactSheets?: any[]
  }
}

function ParticipantContactSheetIndicator({ participant }: ParticipantContactSheetIndicatorProps) {
  const hasContactSheet = participant.contactSheets && participant.contactSheets.length > 0

  if (hasContactSheet) {
    return null
  }

  return (
    <div className="items-center flex rounded-lg border border-border min-w-[260px] bg-background">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-200">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    <Grid3x3 className="h-5 w-5 text-orange-600" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>No contact sheet has been generated yet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Missing Contact Sheet
            </h3>
            <p className="text-xs text-muted-foreground mt-1">No contact sheet generated</p>
          </div>
        </div>
      </CardContent>
    </div>
  )
}

interface ParticipantZipIndicatorProps {
  participant: Participant & {
    zippedSubmissions?: any[]
  }
}

function ParticipantZipIndicator({ participant }: ParticipantZipIndicatorProps) {
  const hasZip = participant.zippedSubmissions && participant.zippedSubmissions.length > 0

  if (hasZip) {
    return null
  }

  return (
    <div className="items-center flex rounded-lg border border-border min-w-[260px] bg-background">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-200">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    <Archive className="h-5 w-5 text-blue-600" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>No zip file has been generated yet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Missing Zip File
            </h3>
            <p className="text-xs text-muted-foreground mt-1">No zip file generated</p>
          </div>
        </div>
      </CardContent>
    </div>
  )
}

interface ParticipantThumbnailsIndicatorProps {
  participant: Participant & {
    submissions?: Submission[]
  }
}

function ParticipantThumbnailsIndicator({ participant }: ParticipantThumbnailsIndicatorProps) {
  const submissions = participant.submissions || []
  const missingThumbnails = submissions.filter((s) => !s.thumbnailKey)
  const hasMissingThumbnails = missingThumbnails.length > 0

  if (!hasMissingThumbnails) {
    return null
  }

  return (
    <div className="items-center flex rounded-lg border border-border min-w-[260px] bg-background">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-200">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    <FileImage className="h-5 w-5 text-purple-600" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{missingThumbnails.length} submission(s) missing thumbnails</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Missing Thumbnails
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {missingThumbnails.length} submission{missingThumbnails.length !== 1 ? "s" : ""}{" "}
              without thumbnails
            </p>
          </div>
        </div>
      </CardContent>
    </div>
  )
}

interface ParticipantExifIndicatorProps {
  participant: Participant & {
    submissions?: Submission[]
  }
}

function ParticipantExifIndicator({ participant }: ParticipantExifIndicatorProps) {
  const submissions = participant.submissions || []
  const missingExif = submissions.filter((s) => !s.exif || Object.keys(s.exif).length === 0)
  const hasMissingExif = missingExif.length > 0

  if (!hasMissingExif) {
    return null
  }

  return (
    <div className="items-center flex rounded-lg border border-border min-w-[260px] bg-background">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-200">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-center">
                    <Info className="h-5 w-5 text-amber-600" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{missingExif.length} submission(s) missing EXIF data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Missing EXIF Data
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {missingExif.length} submission{missingExif.length !== 1 ? "s" : ""} without EXIF
            </p>
          </div>
        </div>
      </CardContent>
    </div>
  )
}
