"use client"

import type { AnyFieldApi } from "@tanstack/react-form"
import { format } from "date-fns"
import Link from "next/link"
import { RuleCard } from "./rule-card"

export function WithinTimerangeRule({ field }: { field: AnyFieldApi }) {
  const hasTimeStart = field.state.value.params?.start !== ""
  const hasTimeEnd = field.state.value.params?.end !== ""

  return (
    <RuleCard
      title="Within Time Range"
      description="Verify photos were taken during the specified competition timeframe using EXIF data."
      recommendedSeverity="error"
      field={field}
    >
      <div className="flex flex-col">
        <div className="grid sm:grid-cols-2 gap-4 max-w-lg pointer-events-none">
          <div className="space-y-1.5">
            <div className="text-xs font-medium">Competition Start Time</div>
            <div className="text-sm text-foreground">
              {hasTimeStart && field.state.value.params?.start
                ? format(new Date(field.state.value.params.start), "yyyy-MM-dd HH:mm")
                : "Not set"}
            </div>
          </div>
          <div className="space-y-1.5 border-l border-border pl-4">
            <div className="text-xs font-medium">Competition End Time</div>
            <div className="text-sm text-foreground">
              {hasTimeEnd && field.state.value.params?.end
                ? format(new Date(field.state.value.params.end), "yyyy-MM-dd HH:mm")
                : "Not set"}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <span className="text-xs text-muted-foreground">
            You can configure the start and end time on the
          </span>
          <Link href="../settings" className="text-xs text-blue-600 underline hover:text-blue-700">
            <span className="ml-1 underline">settings page</span>
          </Link>
        </div>
      </div>
    </RuleCard>
  )
}
