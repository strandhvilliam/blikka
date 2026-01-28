"use client"

import { format } from "date-fns"
import Link from "next/link"
import { RuleCard, type RuleValue } from "./rule-card"
import type { WithinTimerangeParams } from "../_lib/schemas"

type WithinTimerangeValue = RuleValue<WithinTimerangeParams>

interface WithinTimerangeRuleProps {
  value: WithinTimerangeValue
  onChange: (value: WithinTimerangeValue) => void
}

export function WithinTimerangeRule({ value, onChange }: WithinTimerangeRuleProps) {
  const hasTimeStart = value.params?.start !== ""
  const hasTimeEnd = value.params?.end !== ""

  return (
    <RuleCard
      title="Within Time Range"
      description="Verify photos were taken during the specified competition timeframe using EXIF data."
      recommendedSeverity="error"
      value={value}
      onChange={onChange}
    >
      <div className="flex flex-col">
        <div className="grid sm:grid-cols-2 gap-4 max-w-lg pointer-events-none">
          <div className="space-y-1.5">
            <div className="text-xs font-medium">Competition Start Time</div>
            <div className="text-sm text-foreground">
              {hasTimeStart && value.params?.start
                ? format(new Date(value.params.start), "yyyy-MM-dd HH:mm")
                : "Not set"}
            </div>
          </div>
          <div className="space-y-1.5 border-l border-border pl-4">
            <div className="text-xs font-medium">Competition End Time</div>
            <div className="text-sm text-foreground">
              {hasTimeEnd && value.params?.end
                ? format(new Date(value.params.end), "yyyy-MM-dd HH:mm")
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
