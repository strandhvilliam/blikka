"use client"

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Mail,
  XCircle,
  Download,
  Shield,
  Grid3x3,
  MoreVertical,
  Archive,
  FileImage,
  Info,
  Loader2,
  RefreshCw,
  Camera,
  Trash2,
} from "lucide-react"
import type { Participant, ValidationResult } from "@blikka/db"
import { useTRPC } from "@/lib/trpc/client"
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn, formatDomainPathname } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PrimaryButton } from "@/components/ui/primary-button"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import {
  getStatusConfig,
  getDeviceIcon,
  getValidationBadgeConfig,
  type ParticipantWithRelations,
} from "../_lib/utils"
import { ParticipantCard } from "./participant-card"
import { ParticipantVerifyDialog } from "./participant-verify-dialog"

export function ParticipantHeader({ participantRef }: { participantRef: string }) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    })
  )

  const runValidationsMutation = useMutation(trpc.validations.runValidations.mutationOptions())
  const generateContactSheetMutation = useMutation(
    trpc.contactSheets.generateContactSheet.mutationOptions()
  )
  const deleteParticipantMutation = useMutation(trpc.participants.delete.mutationOptions())

  const handleRunValidations = () =>
    runValidationsMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success("Validations completed successfully")
          queryClient.invalidateQueries({
            queryKey: trpc.validations.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.participants.pathKey(),
          })
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to run validations")
        },
      }
    )

  const handleGenerateContactSheet = () =>
    generateContactSheetMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success("Contact sheet generated successfully")
          queryClient.invalidateQueries({
            queryKey: trpc.contactSheets.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.participants.pathKey(),
          })
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to generate contact sheet")
        },
      }
    )

  const handleDeleteParticipant = () =>
    deleteParticipantMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success("Participant deleted successfully")
          queryClient.invalidateQueries({
            queryKey: trpc.participants.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.zipFiles.pathKey(),
          })
          router.push(formatDomainPathname(`/admin/dashboard/submissions`, domain))
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to delete participant")
        },
      }
    )
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ParticipantHeaderInfo participant={participant} />
        <ParticipantHeaderActions
          participant={participant}
          onRunValidations={handleRunValidations}
          isRunningValidations={runValidationsMutation.isPending}
          onGenerateContactSheet={handleGenerateContactSheet}
          isGeneratingContactSheet={generateContactSheetMutation.isPending}
          onDeleteParticipant={() => setIsDeleteDialogOpen(true)}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <ParticipantStatusIndicator
          participant={participant}
          handleOpenVerifyDialog={() => setIsVerifyDialogOpen(true)}
        />
        <ParticipantCompetitionClassCard participant={participant} />
        <ParticipantDeviceGroupCard participant={participant} />
        <ParticipantValidationIndicator
          participant={participant}
          isRunningValidations={runValidationsMutation.isPending}
          onRunValidations={handleRunValidations}
        />
        <ParticipantContactSheetIndicator
          participant={participant}
          onGenerateContactSheet={handleGenerateContactSheet}
          isGeneratingContactSheet={generateContactSheetMutation.isPending}
        />
        <ParticipantZipIndicator participant={participant} />
        <ParticipantThumbnailsIndicator participant={participant} />
        <ParticipantExifIndicator participant={participant} />
      </div>
      <ParticipantVerifyDialog
        isOpen={isVerifyDialogOpen}
        onOpenChange={setIsVerifyDialogOpen}
        participant={participant}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Participant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete participant #{participant.reference} -{" "}
              {participant.firstname} {participant.lastname}? This action cannot be undone and will
              permanently delete all associated data including submissions, validations, and contact
              sheets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteParticipant}
              disabled={deleteParticipantMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteParticipantMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Participant
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ParticipantHeaderInfo({
  participant,
}: {
  participant: Participant & { validationResults: ValidationResult[] }
}) {
  const domain = useDomain()
  const badgeConfig = getValidationBadgeConfig(participant.validationResults)

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" asChild className="h-9 w-9">
        <Link href={formatDomainPathname(`/admin/dashboard/submissions`, domain)}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight font-rocgrotesk">
            {`#${participant.reference} - `}
            {`${participant.firstname} ${participant.lastname}`}
          </h1>
          {badgeConfig.hasValidations && (
            <Badge className={cn("ml-2", badgeConfig.badgeColor)}>
              <badgeConfig.icon className="h-3.5 w-3.5 mr-1" />
              {badgeConfig.label}
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
  onDeleteParticipant,
  onRunValidations,
  isRunningValidations,
  onGenerateContactSheet,
  isGeneratingContactSheet,
}: {
  participant: ParticipantWithRelations
  onDeleteParticipant: () => void
  onRunValidations: () => void
  isRunningValidations: boolean
  onGenerateContactSheet: () => void
  isGeneratingContactSheet: boolean
}) {
  const hasSubmissions = participant.submissions && participant.submissions.length > 0

  const handleRegenerateContactSheet = () => {
    onGenerateContactSheet()
  }

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
          <Button variant="outline" size="icon" className="h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={onRunValidations}
            disabled={isRunningValidations || !hasSubmissions}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRunningValidations && "animate-spin")} />
            Re-run validations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleRegenerateContactSheet}
            disabled={isGeneratingContactSheet || !hasSubmissions}
          >
            <Grid3x3 className="h-4 w-4 mr-2" />
            Regenerate contact sheet
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDeleteParticipant}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete participant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ParticipantCompetitionClassCard({
  participant,
}: {
  participant: ParticipantWithRelations
}) {
  return (
    <ParticipantCard
      icon={
        <span className="w-5 h-5 text-center text-sm font-bold font-mono flex items-center justify-center">
          {participant.competitionClass?.numberOfPhotos || "?"}
        </span>
      }
      title={
        <>
          <span className="font-normal text-muted-foreground">Class:</span>{" "}
          {participant.competitionClass?.name || "No class assigned"}
        </>
      }
      description={participant.competitionClass?.description}
    />
  )
}

function ParticipantDeviceGroupCard({ participant }: { participant: ParticipantWithRelations }) {
  const Icon = getDeviceIcon(participant.deviceGroup?.icon)

  return (
    <ParticipantCard
      icon={<Icon className="h-5 w-5" />}
      title={
        <>
          <span className="font-normal text-muted-foreground">Device:</span>{" "}
          {participant.deviceGroup?.name || "No device group"}
        </>
      }
      description={participant.deviceGroup?.description}
    />
  )
}

const VALID_CONTACT_SHEET_PHOTO_AMOUNT = [8, 24]

function ParticipantContactSheetIndicator({
  participant,
  onGenerateContactSheet,
  isGeneratingContactSheet,
}: {
  participant: ParticipantWithRelations
  onGenerateContactSheet: () => void
  isGeneratingContactSheet: boolean
}) {
  const hasContactSheet = participant.contactSheets && participant.contactSheets.length > 0
  const submissions = participant.submissions || []
  const submissionCount = submissions.length
  const isValidPhotoCount = VALID_CONTACT_SHEET_PHOTO_AMOUNT.includes(submissionCount)

  if (hasContactSheet) {
    return null
  }

  const icon = <Grid3x3 className="h-5 w-5 text-orange-600" />
  const iconContainerClassName = "p-2 rounded-lg bg-orange-500/10 border border-orange-200"

  if (!isValidPhotoCount) {
    return (
      <ParticipantCard
        icon={icon}
        iconContainerClassName={iconContainerClassName}
        title={
          <>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            No contact sheet
          </>
        }
        description={
          <>
            Contact sheets require {VALID_CONTACT_SHEET_PHOTO_AMOUNT.join(" or ")} photos. Current:{" "}
            {submissionCount}
          </>
        }
      />
    )
  }

  return (
    <ParticipantCard
      icon={icon}
      iconContainerClassName={iconContainerClassName}
      title={
        <>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Missing Contact Sheet
        </>
      }
      description="No contact sheet generated"
      action={
        <PrimaryButton
          className="w-fit h-8 text-xs"
          disabled={isGeneratingContactSheet}
          onClick={onGenerateContactSheet}
        >
          {isGeneratingContactSheet ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Grid3x3 className="h-3.5 w-3.5" />
              Generate contact sheet
            </>
          )}
        </PrimaryButton>
      }
    />
  )
}

function ParticipantZipIndicator({ participant }: { participant: ParticipantWithRelations }) {
  const hasZip = participant.zippedSubmissions && participant.zippedSubmissions.length > 0

  if (hasZip) {
    return null
  }

  return (
    <ParticipantCard
      icon={<Archive className="h-5 w-5 text-blue-600" />}
      iconContainerClassName="p-2 rounded-lg bg-blue-500/10 border border-blue-200"
      title={
        <>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Missing Zip File
        </>
      }
      description="No zip file generated"
    />
  )
}

function ParticipantThumbnailsIndicator({
  participant,
}: {
  participant: ParticipantWithRelations
}) {
  const submissions = participant.submissions || []
  const missingThumbnails = submissions.filter((s) => !s.thumbnailKey)
  const hasMissingThumbnails = missingThumbnails.length > 0

  if (!hasMissingThumbnails) {
    return null
  }

  return (
    <ParticipantCard
      icon={<FileImage className="h-5 w-5 text-purple-600" />}
      iconContainerClassName="p-2 rounded-lg bg-purple-500/10 border border-purple-200"
      title={
        <>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Missing Thumbnails
        </>
      }
      description={
        <>
          {missingThumbnails.length} submission{missingThumbnails.length !== 1 ? "s" : ""} without
          thumbnails
        </>
      }
    />
  )
}

function ParticipantExifIndicator({ participant }: { participant: ParticipantWithRelations }) {
  const submissions = participant.submissions || []
  const missingExif = submissions.filter((s) => !s.exif || Object.keys(s.exif).length === 0)
  const hasMissingExif = missingExif.length > 0

  if (!hasMissingExif) {
    return null
  }

  return (
    <ParticipantCard
      icon={<Info className="h-5 w-5 text-amber-600" />}
      iconContainerClassName="p-2 rounded-lg bg-amber-500/10 border border-amber-200"
      title={
        <>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Missing EXIF Data
        </>
      }
      description={
        <>
          {missingExif.length} submission{missingExif.length !== 1 ? "s" : ""} without EXIF
        </>
      }
    />
  )
}

function ParticipantValidationIndicator({
  participant,
  isRunningValidations,
  onRunValidations,
}: {
  participant: ParticipantWithRelations
  isRunningValidations: boolean
  onRunValidations: () => void
}) {
  const globalValidations = participant.validationResults.filter((result) => !result.fileName)
  const hasValidations = globalValidations.length > 0
  const hasSubmissions = participant.submissions && participant.submissions.length > 0

  if (!isRunningValidations && hasValidations) {
    return null
  }

  if (!hasSubmissions) {
    return null
  }

  const icon = isRunningValidations ? (
    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
  ) : (
    <CheckCircle className="h-5 w-5 text-blue-600" />
  )

  return (
    <ParticipantCard
      icon={icon}
      iconContainerClassName="p-2 rounded-lg border bg-blue-500/10 border-blue-200"
      title={
        isRunningValidations ? (
          <>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            Running Validations
          </>
        ) : (
          <>
            <Info className="h-4 w-4 text-blue-500" />
            No Validations
          </>
        )
      }
      description={
        isRunningValidations
          ? "Please wait while validations complete"
          : "Click 'Run validations' to start"
      }
      action={
        <PrimaryButton
          onClick={onRunValidations}
          disabled={isRunningValidations || !hasSubmissions}
          className="w-fit h-8 text-xs"
        >
          {isRunningValidations ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Run validations
            </>
          )}
        </PrimaryButton>
      }
    />
  )
}

function ParticipantStatusIndicator({
  participant,
  handleOpenVerifyDialog,
}: {
  participant: ParticipantWithRelations
  handleOpenVerifyDialog: () => void
}) {
  const statusConfig = getStatusConfig(participant.status)
  const Icon = <statusConfig.icon className="h-5 w-5" />

  return (
    <ParticipantCard
      icon={Icon}
      iconContainerClassName={cn("p-2 rounded-lg bg-muted border", statusConfig.color)}
      title={
        <span className={cn(statusConfig.color)}>
          <span className="font-normal text-muted-foreground">Status:</span> {statusConfig.label}
        </span>
      }
      description={statusConfig.description}
      className={cn("border-2", statusConfig.borderColor, statusConfig.bgColor)}
      action={
        <>
          {participant.status === "processing" && (
            <PrimaryButton className="w-fit h-8 text-xs" onClick={() => {}}>
              <Shield className="h-3.5 w-3.5" />
              Mark as completed
            </PrimaryButton>
          )}
          {participant.status === "completed" && (
            <PrimaryButton className="w-fit h-8 text-xs" onClick={handleOpenVerifyDialog}>
              <Shield className="h-3.5 w-3.5" />
              Verify Now
            </PrimaryButton>
          )}
        </>
      }
    />
  )
}
