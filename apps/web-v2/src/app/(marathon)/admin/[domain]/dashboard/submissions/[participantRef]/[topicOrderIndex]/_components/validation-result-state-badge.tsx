import { ValidationResult } from "@blikka/db"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"

export function ValidationResultStateBadge({
  validationResults,
}: {
  validationResults: ValidationResult[]
}) {
  const hasValidationResults = validationResults.length > 0
  const allPassed =
    hasValidationResults && validationResults.every((result) => result.outcome === "passed")
  const hasFailed =
    hasValidationResults && validationResults.some((result) => result.outcome === "failed")

  const getValidationBadgeStyle = () => {
    if (allPassed) return "bg-green-500/15 text-green-600 hover:bg-green-500/20"
    if (hasFailed) return "bg-destructive/15 text-destructive hover:bg-destructive/20"
    return "bg-yellow-500/15 text-yellow-600 border-yellow-200 hover:bg-yellow-500/20"
  }

  const getValidationIcon = () => {
    if (allPassed) return <CheckCircle className="h-3.5 w-3.5 mr-1" />
    if (hasFailed) return <XCircle className="h-3.5 w-3.5 mr-1" />
    return <AlertTriangle className="h-3.5 w-3.5 mr-1" />
  }

  const getValidationText = () => {
    if (allPassed) return "Valid"
    if (hasFailed) return "Error"
    return "Warning"
  }

  if (!hasValidationResults) return null

  return (
    <Badge className={cn("ml-2", getValidationBadgeStyle())}>
      {getValidationIcon()}
      {getValidationText()}
    </Badge>
  )
}
