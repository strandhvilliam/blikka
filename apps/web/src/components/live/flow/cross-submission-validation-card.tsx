'use client'

import { useTranslations } from 'next-intl'
import {
  RULE_KEY_DISPLAY_LABELS,
  VALIDATION_OUTCOME,
  type ValidationResult,
} from '@blikka/validation'

import { cn } from '@/lib/utils'
import { createValidationResultKey } from '@/lib/validation'
import { ValidationStatusBadge } from './validation-status-badge'

function ruleLabel(ruleKey: string) {
  const key = ruleKey.toLowerCase()
  if (key in RULE_KEY_DISPLAY_LABELS) {
    return RULE_KEY_DISPLAY_LABELS[key as keyof typeof RULE_KEY_DISPLAY_LABELS]
  }

  return ruleKey.replace(/_/g, ' ')
}

function getMessageClassName(result: ValidationResult) {
  if (result.severity === 'error') {
    return 'text-destructive/90'
  }

  return 'text-amber-900/80'
}

function getCardTone(results: ValidationResult[]) {
  const hasError = results.some((result) => result.severity === 'error')

  if (hasError) {
    return 'border-destructive/30 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]'
  }

  return 'border-amber-200/90 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]'
}

interface CrossSubmissionValidationIssueProps {
  result: ValidationResult
}

function CrossSubmissionValidationIssue({ result }: CrossSubmissionValidationIssueProps) {
  return (
    <div className="space-y-1.5 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <ValidationStatusBadge outcome={VALIDATION_OUTCOME.FAILED} severity={result.severity} />
        <p className="text-sm font-semibold leading-snug text-foreground">
          {ruleLabel(result.ruleKey)}
        </p>
      </div>

      {result.message ? (
        <p className={cn('text-xs leading-relaxed', getMessageClassName(result))}>
          {result.message}
        </p>
      ) : null}
    </div>
  )
}

interface CrossSubmissionValidationCardProps {
  results: ValidationResult[]
}

export function CrossSubmissionValidationCard({ results }: CrossSubmissionValidationCardProps) {
  const t = useTranslations('FlowPage.uploadStep')

  if (results.length === 0) {
    return null
  }

  const hasWarning = results.some((result) => result.severity === 'warning')

  return (
    <div
      role="alert"
      className={cn('overflow-hidden rounded-2xl border-2 bg-white', getCardTone(results))}
    >
      <div className="divide-y divide-dashed divide-border/80">
        {results.map((result, index) => (
          <CrossSubmissionValidationIssue
            key={`${createValidationResultKey(result)}-${index}`}
            result={result}
          />
        ))}
      </div>

      {hasWarning ? (
        <div className="border-t border-dashed border-border/80 bg-amber-50/50 px-3.5 py-2.5">
          <p className="text-xs leading-relaxed text-amber-900/85">
            {t('crossSubmissionManualReview')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
