"use client"

import { Smartphone } from "lucide-react"
import { RuleCard, type RuleValue } from "./rule-card"

type SameDeviceValue = RuleValue<null>

interface SameDeviceRuleProps {
  value: SameDeviceValue
  onChange: (value: SameDeviceValue) => void
}

export function SameDeviceRule({ value, onChange }: SameDeviceRuleProps) {
  return (
    <RuleCard
      title="Same Device"
      description="Require all photos in a single submission to originate from the same camera or device."
      icon={Smartphone}
      recommendedSeverity="warning"
      value={value}
      onChange={onChange}
    />
  )
}
