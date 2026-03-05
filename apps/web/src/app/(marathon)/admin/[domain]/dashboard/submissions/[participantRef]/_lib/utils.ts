import type { ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  type LucideIcon,
  Shield,
  Upload,
  Smartphone,
  Zap,
  Camera,
  XCircle,
} from "lucide-react"

import type {
  Participant,
  ValidationResult,
  CompetitionClass,
  DeviceGroup,
  Submission,
} from "@blikka/db"

export type ParticipantWithRelations = Participant & {
  validationResults: ValidationResult[]
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  submissions?: Submission[]
  contactSheets?: any[]
  zippedSubmissions?: any[]
}

const statusConfigMap: Record<
  string,
  {
    icon: LucideIcon
    label: string
    description: string
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  initialized: {
    icon: Clock,
    label: "Initialized",
    description: "Participant has been created but not started",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-200",
  },
  ready_to_upload: {
    icon: Upload,
    label: "Ready to Upload",
    description: "Participant can start uploading photos",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    description: "Photos are being processed and validated",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  completed: {
    icon: Shield,
    label: "Submitted",
    description: "All photos uploaded, awaiting staff verification",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  verified: {
    icon: CheckCircle,
    label: "Verified",
    description: "Submission has been uploaded and verified",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
} as const

export const getStatusConfig = (status: string) => {
  return (
    statusConfigMap[status as keyof typeof statusConfigMap] || {
      icon: AlertTriangle,
      label: status,
      description: "Unknown status",
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      borderColor: "border-gray-200",
    }
  )
}

export const getDeviceIcon = (icon?: string): LucideIcon => {
  switch (icon) {
    case "smartphone":
      return Smartphone
    case "action-camera":
      return Zap
    default:
      return Camera
  }
}

function getValidationBadgeColor(allPassed: boolean, hasErrors: boolean) {
  if (allPassed) return "bg-green-500/15 text-green-600 hover:bg-green-500/20"
  if (hasErrors) return "bg-destructive/15 text-destructive hover:bg-destructive/20"
  return "bg-yellow-500/15 text-yellow-600 border-yellow-200 hover:bg-yellow-500/20"
}

function getValidationBadgeIcon(allPassed: boolean, hasErrors: boolean): LucideIcon {
  if (allPassed) return CheckCircle
  if (hasErrors) return XCircle
  return AlertTriangle
}

function getValidationBadgeLabel(allPassed: boolean, hasErrors: boolean) {
  if (allPassed) return "Valid"
  if (hasErrors) return "Error"
  return "Warning"
}

export const getValidationBadgeConfig = (validationResults: ValidationResult[]) => {
  const globalValidations = validationResults.filter((result) => !result.fileName)
  const hasFailedValidations = globalValidations.some((result) => result.outcome === "failed")
  const hasErrors = globalValidations.some(
    (result) => result.severity === "error" && result.outcome === "failed"
  )
  const allPassed = globalValidations.length > 0 && !hasFailedValidations

  return {
    badgeColor: getValidationBadgeColor(allPassed, hasErrors),
    icon: getValidationBadgeIcon(allPassed, hasErrors),
    label: getValidationBadgeLabel(allPassed, hasErrors),
    hasValidations: globalValidations.length > 0,
  }
}
