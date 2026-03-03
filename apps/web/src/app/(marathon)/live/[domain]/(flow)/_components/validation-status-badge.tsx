"use client";

import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { VALIDATION_OUTCOME } from "@blikka/validation";

interface ValidationStatusBadgeProps {
  outcome?: (typeof VALIDATION_OUTCOME)[keyof typeof VALIDATION_OUTCOME];
  severity?: "error" | "warning";
}

export function ValidationStatusBadge({
  outcome,
  severity,
}: ValidationStatusBadgeProps) {
  if (!outcome) return null;

  let badgeClass = "";
  let Icon = CheckCircle;
  let label = "";

  if (outcome === VALIDATION_OUTCOME.PASSED) {
    badgeClass =
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    Icon = CheckCircle;
    label = "Passed";
  } else if (outcome === VALIDATION_OUTCOME.FAILED) {
    if (severity === "error") {
      badgeClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      Icon = AlertCircle;
      label = "Failed";
    } else {
      badgeClass =
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100";
      Icon = AlertTriangle;
      label = "Warning";
    }
  } else if (outcome === VALIDATION_OUTCOME.SKIPPED) {
    badgeClass =
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100";
    Icon = AlertTriangle;
    label = "Warning";
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
