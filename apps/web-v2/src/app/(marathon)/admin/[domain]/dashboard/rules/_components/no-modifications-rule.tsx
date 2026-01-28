"use client"

import { RuleCard, type RuleValue } from "./rule-card"

type NoModificationsValue = RuleValue<null>

interface NoModificationsRuleProps {
  value: NoModificationsValue
  onChange: (value: NoModificationsValue) => void
}

export function NoModificationsRule({ value, onChange }: NoModificationsRuleProps) {
  return (
    <RuleCard
      title="No Digital Modifications"
      description="Detect if photos show signs of editing in software like Photoshop, Lightroom, etc."
      recommendedSeverity="warning"
      value={value}
      onChange={onChange}
    />
  )
}
