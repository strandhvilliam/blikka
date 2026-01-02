"use client"

import type { AnyFieldApi } from "@tanstack/react-form"
import { RuleCard } from "./rule-card"

export function StrictTimestampOrderingRule({ field }: { field: AnyFieldApi }) {
  return (
    <RuleCard
      title="Strict Timestamp Ordering"
      description="Ensure photo timestamps align chronologically with the theme submission order."
      recommendedSeverity="warning"
      field={field}
    />
  )
}
