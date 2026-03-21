"use client"

import { Switch } from "@/components/ui/switch"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import type { SeverityLevel } from "@blikka/validation"
import type { LucideIcon } from "lucide-react"
import { RulesSeverityToggle } from "./rules-severity-toggle"

export interface RuleValue<TParams = null> {
  enabled: boolean
  severity: string
  params: TParams
}

interface RuleCardProps<TParams = null> {
  title: string
  description: string
  icon: LucideIcon
  recommendedSeverity: SeverityLevel
  value: RuleValue<TParams>
  onChange: (value: RuleValue<TParams>) => void
  children?: React.ReactNode
}

export function RuleCard<TParams = null>({
  title,
  description,
  icon: Icon,
  recommendedSeverity,
  value,
  onChange,
  children,
}: RuleCardProps<TParams>) {
  return (
    <motion.div
      layout
      className={cn(
        "group relative rounded-xl border bg-white transition-shadow duration-200",
        value.enabled
          ? "border-brand-primary/20 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
          : "border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
            value.enabled
              ? "bg-brand-primary/10 text-brand-primary"
              : "bg-muted/80 text-muted-foreground/60"
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3
                className={cn(
                  "text-[15px] font-semibold tracking-tight transition-colors duration-200",
                  value.enabled ? "text-foreground" : "text-foreground/70"
                )}
              >
                {title}
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                {description}
              </p>
            </div>
            <Switch
              id={title}
              checked={value.enabled}
              onCheckedChange={(checked) => {
                onChange({ ...value, enabled: checked })
              }}
              className="shrink-0 data-[state=checked]:bg-brand-primary"
              aria-labelledby={`${title}-heading`}
            />
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {value.enabled && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-5 pt-4 border-t border-border/50 flex flex-wrap justify-between items-center gap-4">
              <RulesSeverityToggle
                severity={value.severity as SeverityLevel}
                onSeverityChange={(severity) => {
                  onChange({ ...value, severity })
                }}
                recommendedSeverity={recommendedSeverity}
              />
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
