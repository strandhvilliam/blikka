"use client"

import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { AlertTriangle, CheckCircle2, ChevronRight, Hammer, ImageIcon, XCircle } from "lucide-react"
import type { CompetitionClass, Topic, ValidationResult } from "@blikka/db"

import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { getCaptureDateLabel, getSubmissionPreviewUrl, getSubmissionThumbnailUrl } from "../_lib/staff-utils"
import type { StaffSubmission } from "../_lib/staff-types"

interface ValidationAccordionProps {
  validationResults: ValidationResult[]
  submissions: StaffSubmission[]
  topics: Topic[]
  competitionClass: CompetitionClass | null
  onThumbnailClick?: (url: string | null) => void
  onOverrule?: (validationId: number) => void
  isOverruling?: boolean
  showOverruleButtons?: boolean
}

function countsFor(validations: ValidationResult[]) {
  return {
    errors: validations.filter((item) => item.outcome === "failed" && item.severity === "error" && !item.overruled)
      .length,
    warnings: validations.filter(
      (item) => item.outcome === "failed" && item.severity === "warning" && !item.overruled
    ).length,
    passed: validations.filter((item) => item.outcome === "passed").length,
  }
}

function ruleLabel(ruleKey: string) {
  switch (ruleKey.toLowerCase()) {
    case "within_timerange":
      return "Outside configured timerange"
    case "same_device":
      return "Multiple devices used"
    default:
      return ruleKey.replace(/_/g, " ")
  }
}

function ValidationSummary({
  title,
  validations,
  submission,
  orderIndex,
  onThumbnailClick,
}: {
  title: string
  validations: ValidationResult[]
  submission?: StaffSubmission | null
  orderIndex?: number
  onThumbnailClick?: (url: string | null) => void
}) {
  const thumbnailUrl = getSubmissionThumbnailUrl(submission)
  const counts = countsFor(validations)
  const thumbnailPreviewUrl = getSubmissionPreviewUrl(submission)
  const thumbnailIsInteractive = Boolean(onThumbnailClick && submission)

  const thumbnailInner = thumbnailUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
  ) : (
    <ImageIcon className="h-6 w-6 text-muted-foreground" />
  )

  const thumbnailClassName =
    "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted"

  return (
    <div className="flex w-full items-stretch">
      <div className="flex shrink-0 items-center pl-3 py-2.5">
        {thumbnailIsInteractive ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onThumbnailClick?.(thumbnailPreviewUrl)
            }}
            className={thumbnailClassName}
          >
            {thumbnailInner}
          </button>
        ) : (
          <div className={cn(thumbnailClassName, "pointer-events-none")}>{thumbnailInner}</div>
        )}
      </div>
      <AccordionPrimitive.Header className="flex min-w-0 flex-1">
        <AccordionPrimitive.Trigger
          className={cn(
            "focus-visible:border-ring focus-visible:ring-ring/50 group flex flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm font-medium outline-none transition-all hover:no-underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {typeof orderIndex === "number" ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[10px] font-bold text-foreground/60">
                  {orderIndex + 1}
                </span>
              ) : null}
              <p className="truncate text-sm font-medium">{title}</p>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {submission ? (getCaptureDateLabel(submission) ?? "Unknown time") : "No upload"}
              </span>
              {counts.errors > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-600">
                  <XCircle className="h-3 w-3" />
                  {counts.errors}
                </span>
              ) : null}
              {counts.warnings > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {counts.warnings}
                </span>
              ) : null}
              {counts.errors === 0 && counts.warnings === 0 && counts.passed > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  OK
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    </div>
  )
}

export function ValidationAccordion({
  validationResults,
  submissions,
  topics,
  competitionClass,
  onThumbnailClick,
  onOverrule,
  isOverruling = false,
  showOverruleButtons = false,
}: ValidationAccordionProps) {
  const visibleTopics = [...topics]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .slice(0, competitionClass?.numberOfPhotos ?? topics.length)

  const globalValidations = validationResults.filter((result) => !result.fileName)

  return (
    <Accordion type="multiple" className="space-y-2">
      {globalValidations.length > 0 ? (
        <AccordionItem value="global" className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <ValidationSummary title="General validations" validations={globalValidations} />
          <AccordionContent className="border-t bg-muted/20 p-0">
            {globalValidations.map((validation) => (
              <div key={validation.id} className="border-b px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{ruleLabel(validation.ruleKey)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{validation.message}</p>
                  </div>
                  {showOverruleButtons &&
                  validation.outcome === "failed" &&
                  validation.severity === "error" &&
                  !validation.overruled ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isOverruling}
                      onClick={() => onOverrule?.(validation.id)}
                    >
                      <Hammer className="mr-1 h-4 w-4" />
                      Overrule
                    </Button>
                  ) : validation.overruled ? (
                    <Badge variant="outline">Overruled</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {visibleTopics.map((topic) => {
        const submission = submissions.find((item) => item.topicId === topic.id)
        const validations = validationResults.filter((result) => result.fileName === submission?.key)

        return (
          <AccordionItem
            key={topic.id}
            value={`submission-${topic.id}`}
            className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
          >
            <ValidationSummary
              title={topic.name}
              orderIndex={topic.orderIndex}
              validations={validations}
              submission={submission}
              onThumbnailClick={onThumbnailClick}
            />
            {validations.length > 0 ? (
              <AccordionContent className="border-t bg-muted/20 p-0">
                {validations.map((validation) => (
                  <div key={validation.id} className="border-b px-4 py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium capitalize">{ruleLabel(validation.ruleKey)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{validation.message}</p>
                      </div>
                      {showOverruleButtons &&
                      validation.outcome === "failed" &&
                      validation.severity === "error" &&
                      !validation.overruled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isOverruling}
                          onClick={() => onOverrule?.(validation.id)}
                        >
                          <Hammer className="mr-1 h-4 w-4" />
                          Overrule
                        </Button>
                      ) : validation.overruled ? (
                        <Badge variant="outline">Overruled</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            ) : null}
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
