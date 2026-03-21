"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { HardDrive } from "lucide-react"
import { RuleCard, type RuleValue } from "./rule-card"
import type { MaxFileSizeParams } from "../_lib/schemas"

type MaxFileSizeValue = RuleValue<MaxFileSizeParams>

interface MaxFileSizeRuleProps {
  value: MaxFileSizeValue
  onChange: (value: MaxFileSizeValue) => void
}

export function MaxFileSizeRule({ value, onChange }: MaxFileSizeRuleProps) {
  const getMbValue = (bytes: number) => Math.round(bytes / (1024 * 1024))

  return (
    <RuleCard
      title="Maximum File Size"
      description="Set the largest allowed file size for individual photos."
      icon={HardDrive}
      recommendedSeverity="error"
      value={value}
      onChange={onChange}
    >
      <div className="space-y-3 max-w-sm w-full">
        <div className="flex justify-between items-baseline">
          <Label htmlFor="maxFileSize" className="text-[13px] font-medium text-muted-foreground">
            Limit
          </Label>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {getMbValue(value.params.maxBytes)} MB
          </span>
        </div>
        <Slider
          id="maxFileSize"
          min={1}
          max={100}
          step={1}
          value={[getMbValue(value.params.maxBytes)]}
          onValueChange={(values) => {
            const sliderValue = values[0]
            if (typeof sliderValue === "number") {
              onChange({
                ...value,
                params: {
                  ...value.params,
                  maxBytes: sliderValue * 1024 * 1024,
                },
              })
            }
          }}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground/60">
          <span>1 MB</span>
          <span>100 MB</span>
        </div>
      </div>
    </RuleCard>
  )
}
