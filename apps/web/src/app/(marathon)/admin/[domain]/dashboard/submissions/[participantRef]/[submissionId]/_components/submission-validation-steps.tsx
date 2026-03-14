"use client"

import type { ValidationResult } from "@blikka/db"
import { AlertTriangle, CheckCircle2, InfoIcon, Star, XCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export function SubmissionValidationSteps({
  validationResults,
}: {
  validationResults: ValidationResult[]
}) {
  const getStatusIcon = (severity: string, outcome: string) => {
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

  const getStatusBadge = (severity: string, outcome: string) => {
    if (outcome === "passed") {
      return <Badge className="bg-green-500/15 text-green-600 border-green-200">Passed</Badge>
    }

    switch (severity) {
      case "warning":
        return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-200">Warning</Badge>
      case "error":
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/20">Error</Badge>
        )
      case "info":
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-200">Info</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[250px]">Rule</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {validationResults.length > 0 ? (
            validationResults.map((result, index) => (
              <TableRow key={index} className="bg-background">
                <TableCell>{getStatusIcon(result.severity, result.outcome)}</TableCell>
                <TableCell>{getStatusBadge(result.severity, result.outcome)}</TableCell>
                <TableCell className="font-medium">
                  {result.ruleKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{result.message}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <InfoIcon className="h-8 w-8 text-muted-foreground/50" />
                  <p>No validation results found for this submission</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
