"use client"

import { format } from "date-fns"
import Link from "next/link"
import { Clock } from "lucide-react"
import { RuleCard, type RuleValue } from "./rule-card"
import type { WithinTimerangeParams } from "../_lib/schemas"

type WithinTimerangeValue = RuleValue<WithinTimerangeParams>

interface WithinTimerangeRuleProps {
  marathonMode?: "marathon" | "by-camera"
  value: WithinTimerangeValue
  onChange: (value: WithinTimerangeValue) => void
}

export function WithinTimerangeRule({
  marathonMode = "marathon",
  value,
  onChange,
}: WithinTimerangeRuleProps) {
  const hasTimeStart = value.params?.start !== ""
  const hasTimeEnd = value.params?.end !== ""

  if (marathonMode === "by-camera") {
    return (
      <RuleCard
        title="Within Time Range"
        description="Checks that the photo was taken today using the capture time from EXIF metadata."
        icon={Clock}
        recommendedSeverity="error"
        value={value}
        onChange={onChange}
      >
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          In by-camera mode each participant uploads a single image per topic, so validation uses the
          photo&apos;s date only: it must have been captured on the current calendar day.
        </p>
      </RuleCard>
    )
  }

  return (
    <RuleCard
      title="Within Time Range"
      description="Verify photos were taken during the specified competition timeframe using EXIF data."
      icon={Clock}
      recommendedSeverity="error"
      value={value}
      onChange={onChange}
    >
      <div className="flex flex-col">
        <div className="grid sm:grid-cols-2 gap-4 max-w-lg pointer-events-none">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Start
            </div>
            <div className="text-sm font-medium text-foreground tabular-nums">
              {hasTimeStart && value.params?.start
                ? format(new Date(value.params.start), "yyyy-MM-dd HH:mm")
                : "Not set"}
            </div>
          </div>
          <div className="space-y-1 sm:border-l sm:border-border/40 sm:pl-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              End
            </div>
            <div className="text-sm font-medium text-foreground tabular-nums">
              {hasTimeEnd && value.params?.end
                ? format(new Date(value.params.end), "yyyy-MM-dd HH:mm")
                : "Not set"}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="../settings"
            className="text-[12px] text-brand-primary hover:text-brand-primary/80 underline underline-offset-2 decoration-brand-primary/30 hover:decoration-brand-primary/60 transition-colors"
          >
            Configure times in settings
          </Link>
        </div>
      </div>
    </RuleCard>
  )
}
