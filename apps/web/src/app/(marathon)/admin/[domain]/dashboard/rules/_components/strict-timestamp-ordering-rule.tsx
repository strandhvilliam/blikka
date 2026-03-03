"use client"

import { RuleCard, type RuleValue } from "./rule-card"

type StrictTimestampOrderingValue = RuleValue<null>

interface StrictTimestampOrderingRuleProps {
  value: StrictTimestampOrderingValue
  onChange: (value: StrictTimestampOrderingValue) => void
}

export function StrictTimestampOrderingRule({ value, onChange }: StrictTimestampOrderingRuleProps) {
  return (
    <RuleCard
      title="Strict Timestamp Ordering"
      description="Ensure photo timestamps align chronologically with the theme submission order."
      recommendedSeverity="warning"
      value={value}
      onChange={onChange}
    />
  )
}
