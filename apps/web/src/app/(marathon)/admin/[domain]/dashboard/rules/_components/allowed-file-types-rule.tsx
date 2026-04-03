"use client"

import { motion } from "motion/react"
import { CheckCircle, AlertCircle, FileImage } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { RuleCard, type RuleValue } from "./rule-card"
import type { AllowedFileTypesParams } from "../_lib/schemas"

const FILE_TYPE_OPTIONS = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
]

type AllowedFileTypesValue = RuleValue<AllowedFileTypesParams>

interface AllowedFileTypesRuleProps {
  value: AllowedFileTypesValue
  onChange: (value: AllowedFileTypesValue) => void
}

export function AllowedFileTypesRule({ value, onChange }: AllowedFileTypesRuleProps) {
  return (
    <RuleCard
      title="Allowed File Types"
      description="Specify permitted image file formats (JPG; PNG is not available yet)."
      icon={FileImage}
      recommendedSeverity="error"
      value={value}
      onChange={onChange}
    >
      <div className="space-y-3 flex flex-col items-end">
        <div className="flex flex-wrap gap-2">
          {FILE_TYPE_OPTIONS.map((option) => {
            const isSelected = value.params.allowedFileTypes.includes(option.value)
            const pngUnavailable = option.value === "png" && !isSelected
            return (
              <motion.button
                key={option.value}
                type="button"
                aria-disabled={pngUnavailable}
                onClick={() => {
                  if (option.value === "png" && !isSelected) {
                    toast.message("PNG is not available at the moment.")
                    return
                  }

                  const currentTypes = [...value.params.allowedFileTypes]
                  const index = currentTypes.indexOf(option.value)

                  if (index > -1) {
                    currentTypes.splice(index, 1)
                  } else {
                    currentTypes.push(option.value)
                  }
                  onChange({
                    ...value,
                    params: {
                      ...value.params,
                      allowedFileTypes: currentTypes,
                    },
                  })
                }}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium",
                  "border flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none transition-colors duration-150",
                  isSelected
                    ? "bg-foreground text-background border-transparent shadow-sm"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/40",
                  pngUnavailable && "cursor-not-allowed opacity-50 hover:bg-muted/40",
                )}
                whileTap={pngUnavailable ? undefined : { scale: 0.97 }}
              >
                {isSelected && <CheckCircle className="h-3.5 w-3.5 opacity-80" />}
                {option.label}
              </motion.button>
            )
          })}
        </div>
        {value.params.allowedFileTypes.length === 0 && (
          <p className="text-[13px] text-amber-700 bg-amber-50/80 py-2 px-3 rounded-lg border border-amber-200/60 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            No file types selected. Users won't be able to upload anything.
          </p>
        )}
      </div>
    </RuleCard>
  )
}
