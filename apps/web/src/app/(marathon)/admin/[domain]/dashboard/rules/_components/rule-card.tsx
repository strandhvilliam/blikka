"use client"

import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { motion } from "motion/react"
import type { SeverityLevel } from "@blikka/validation"
import { RulesSeverityToggle } from "./rules-severity-toggle"

export interface RuleValue<TParams = null> {
  enabled: boolean
  severity: string
  params: TParams
}

interface RuleCardProps<TParams = null> {
  title: string
  description: string
  recommendedSeverity: SeverityLevel
  value: RuleValue<TParams>
  onChange: (value: RuleValue<TParams>) => void
  children?: React.ReactNode
}

export function RuleCard<TParams = null>({
  title,
  description,
  recommendedSeverity,
  value,
  onChange,
  children,
}: RuleCardProps<TParams>) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex-shrink-0 self-center ml-4">
          <Switch
            id={title}
            checked={value.enabled}
            onCheckedChange={(checked) => {
              onChange({ ...value, enabled: checked })
            }}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            aria-labelledby={`${title}-heading`}
          />
        </div>
      </div>

      {value.enabled && (
        <motion.div
          key="content"
          initial={{ opacity: 0.5, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="overflow-hidden pt-4 border-t border-border/60 mt-4 flex justify-between items-center"
        >
          <RulesSeverityToggle
            severity={value.severity as SeverityLevel}
            onSeverityChange={(severity) => {
              onChange({ ...value, severity })
            }}
            recommendedSeverity={recommendedSeverity}
          />
          {children}
        </motion.div>
      )}
    </Card>
  )
}
