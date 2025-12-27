import { ValidationResult } from "@blikka/db"
import { AlertTriangle, CheckCircle2, InfoIcon, Star, XCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function SubmissionValidationSteps({
  validationResults,
}: {
  validationResults: ValidationResult[]
}) {
  const getStatusContent = (severity: string, outcome: string) => {
    if (outcome === "passed") {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }

    switch (severity) {
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "info":
        return <InfoIcon className="h-5 w-5 text-blue-500" />
      default:
        return <Star className="h-5 w-5 text-purple-500" />
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {validationResults.length > 0 ? (
            validationResults.map((result, index) => (
              <TableRow key={index} className="bg-background">
                <TableCell>{getStatusContent(result.severity, result.outcome)}</TableCell>
                <TableCell className="font-medium">{result.ruleKey.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{result.message}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                No validation results found for this submission
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
