"use client"

import { format } from "date-fns"

interface DateDurationSummaryProps {
  startDate: Date | null
  endDate: Date | null
}

export function DateDurationSummary({
  startDate,
  endDate,
}: DateDurationSummaryProps) {
  return (
    <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-muted flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-sm font-medium">Marathon Duration:</span>
        {startDate && endDate ? (
          <span className="text-sm">
            {format(startDate, "PPP")} - {format(endDate, "PPP")}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Select both dates to see duration
          </span>
        )}
      </div>
      {startDate && endDate && (
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-muted-foreground">
            {format(startDate, "kk:mm")} - {format(endDate, "kk:mm")}
          </span>
        </div>
      )}
    </div>
  )
}
