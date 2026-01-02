"use client"

import type { AnyFieldApi } from "@tanstack/react-form"
import { RuleCard } from "./rule-card"

export function NoModificationsRule({ field }: { field: AnyFieldApi }) {
  return (
    <RuleCard
      title="No Digital Modifications"
      description="Detect if photos show signs of editing in software like Photoshop, Lightroom, etc."
      recommendedSeverity="warning"
      field={field}
    />
  )
}
