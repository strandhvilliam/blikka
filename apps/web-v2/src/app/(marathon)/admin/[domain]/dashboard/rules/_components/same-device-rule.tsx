"use client"

import type { AnyFieldApi } from "@tanstack/react-form"
import { RuleCard } from "./rule-card"

export function SameDeviceRule({ field }: { field: AnyFieldApi }) {
  return (
    <RuleCard
      title="Same Device"
      description="Require all photos in a single submission to originate from the same camera/device."
      recommendedSeverity="warning"
      field={field}
    />
  )
}
