"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
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
      recommendedSeverity="error"
      value={value}
      onChange={onChange}
    >
      <div className="space-y-4 max-w-md w-full">
        <div>
          <div className="mb-3 flex justify-between items-center">
            <div className="space-y-4 flex flex-col items-start w-full">
              <Label htmlFor="maxFileSize" className="text-sm font-medium">
                Limit:{" "}
                <span className="text-primary font-semibold tabular-nums bg-muted px-2 py-1 rounded-md">
                  {getMbValue(value.params.maxBytes)} MB
                </span>
              </Label>
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
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>1 MB</span>
            <span>100 MB</span>
          </div>
        </div>
      </div>
    </RuleCard>
  )
}
