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
    <div className="flex flex-col">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 mb-1.5 cursor-pointer">
              <InfoIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <p className={cn("text-xs text-muted-foreground")}>
                Recommended: {recommendedSeverity === "error" ? "Restrict" : "Warning"}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-2 min-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="font-semibold text-xs text-red-600">Restrict</span>
                <span className="text-xs text-muted-foreground">
                  Prevents the user from submitting
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-semibold text-xs text-amber-500">Warning</span>
                <span className="text-xs text-muted-foreground">
                  Warns the user, but allows submission
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <motion.div
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1 bg-muted/60 rounded-full p-0.5 border border-border/60"
      >
        <motion.button
          type="button"
          onClick={() => onSeverityChange("warning")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1",
            severity === "warning"
              ? "bg-amber-100 text-amber-800 shadow-sm border border-amber-200"
              : "text-muted-foreground hover:bg-background/50"
          )}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          aria-pressed={severity === "warning"}
        >
          Warning
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onSeverityChange("error")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1",
            severity === "error"
              ? "bg-red-100 text-red-800 shadow-sm border border-red-200"
              : "text-muted-foreground hover:bg-background/50"
          )}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          aria-pressed={severity === "error"}
        >
          Restrict
        </motion.button>
      </motion.div>
    </div>
  )
}
