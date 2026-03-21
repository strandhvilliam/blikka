"use client"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { motion } from "motion/react"
import type { SeverityLevel } from "@blikka/validation"

interface SeverityToggleProps {
  severity: SeverityLevel
  onSeverityChange: (severity: SeverityLevel) => void
  recommendedSeverity: SeverityLevel
}

export function RulesSeverityToggle({
  severity,
  onSeverityChange,
  recommendedSeverity,
}: SeverityToggleProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help w-fit">
              <InfoIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {recommendedSeverity === "error" ? "Recommended: Restrict" : "Recommended: Warning"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <span className="font-semibold text-xs text-red-600">Restrict</span>
                <span className="text-xs text-muted-foreground">
                  Prevents submission
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-semibold text-xs text-amber-600">Warning</span>
                <span className="text-xs text-muted-foreground">
                  Allows submission with notice
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-center rounded-lg bg-muted/50 p-0.5 border border-border/40">
        <motion.button
          type="button"
          onClick={() => onSeverityChange("warning")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150",
            severity === "warning"
              ? "bg-white text-amber-700 shadow-sm border border-amber-200/80"
              : "text-muted-foreground hover:text-foreground/70"
          )}
          whileTap={{ scale: 0.97 }}
          aria-pressed={severity === "warning"}
        >
          <span className="flex items-center gap-1.5">
            <span className={cn(
              "inline-block w-1.5 h-1.5 rounded-full",
              severity === "warning" ? "bg-amber-500" : "bg-muted-foreground/30"
            )} />
            Warning
          </span>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onSeverityChange("error")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150",
            severity === "error"
              ? "bg-white text-red-700 shadow-sm border border-red-200/80"
              : "text-muted-foreground hover:text-foreground/70"
          )}
          whileTap={{ scale: 0.97 }}
          aria-pressed={severity === "error"}
        >
          <span className="flex items-center gap-1.5">
            <span className={cn(
              "inline-block w-1.5 h-1.5 rounded-full",
              severity === "error" ? "bg-red-500" : "bg-muted-foreground/30"
            )} />
            Restrict
          </span>
        </motion.button>
      </div>
    </div>
  )
}
