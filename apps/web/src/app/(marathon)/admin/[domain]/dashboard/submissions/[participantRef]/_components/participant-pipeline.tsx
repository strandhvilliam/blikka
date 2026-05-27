'use client'

import {
  Archive,
  CheckCircle2,
  Grid3x3,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ParticipantWithRelations } from '../_lib/utils'

const VALID_CONTACT_SHEET_PHOTO_AMOUNT = [8, 24]

type StageState = 'ok' | 'pending' | 'warning' | 'error' | 'running'

interface StageProps {
  icon: LucideIcon
  label: string
  state: StageState
  primaryText: string
  secondaryText?: string
  action?: { label: string; onClick: () => void; disabled?: boolean }
  isFirst?: boolean
  isLast?: boolean
}

const stateBadgeStyles: Record<StageState, { dot: string; iconBox: string; primary: string }> = {
  ok: {
    dot: 'bg-emerald-500',
    iconBox: 'bg-emerald-500/10 text-emerald-600',
    primary: 'text-emerald-700',
  },
  pending: {
    dot: 'bg-muted-foreground/40',
    iconBox: 'bg-muted text-muted-foreground',
    primary: 'text-foreground',
  },
  warning: {
    dot: 'bg-amber-500',
    iconBox: 'bg-amber-500/10 text-amber-600',
    primary: 'text-amber-700',
  },
  error: {
    dot: 'bg-red-500',
    iconBox: 'bg-red-500/10 text-red-600',
    primary: 'text-red-700',
  },
  running: {
    dot: 'bg-blue-500',
    iconBox: 'bg-blue-500/10 text-blue-600',
    primary: 'text-blue-700',
  },
}

function PipelineStage({
  icon: Icon,
  label,
  state,
  primaryText,
  secondaryText,
  action,
}: StageProps) {
  const styles = stateBadgeStyles[state]

  return (
    <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          styles.iconBox,
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', state === 'running' && 'animate-spin')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {label}
          </p>
        </div>
        <p className={cn('mt-0.5 text-[13px] font-semibold leading-tight', styles.primary)}>
          {primaryText}
        </p>
        {secondaryText ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
            {secondaryText}
          </p>
        ) : null}
        {action ? (
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className="mt-2 h-7 text-[11px] px-2.5"
          >
            {action.disabled ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Working…
              </>
            ) : (
              action.label
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

interface ParticipantPipelineProps {
  participant: ParticipantWithRelations
  isRunningValidations: boolean
  onRunValidations: () => void
  isGeneratingContactSheet: boolean
  onGenerateContactSheet: () => void
}

export function ParticipantPipeline({
  participant,
  isRunningValidations,
  onRunValidations,
  isGeneratingContactSheet,
  onGenerateContactSheet,
}: ParticipantPipelineProps) {
  const submissions = participant.submissions ?? []
  const hasSubmissions = submissions.length > 0

  const globalValidations = participant.validationResults.filter((r) => !r.fileName)
  const hasFailedValidations = globalValidations.some((r) => r.outcome === 'failed')
  const hasErrors = globalValidations.some(
    (r) => r.severity === 'error' && r.outcome === 'failed',
  )
  const hasWarnings = globalValidations.some(
    (r) => r.severity === 'warning' && r.outcome === 'failed',
  )
  const allPassed = globalValidations.length > 0 && !hasFailedValidations

  const validationStage: StageProps = (() => {
    if (isRunningValidations) {
      return {
        icon: Loader2,
        label: 'Validations',
        state: 'running',
        primaryText: 'Running validations…',
        secondaryText: 'Please wait while checks complete.',
      }
    }
    if (!hasSubmissions) {
      return {
        icon: ShieldCheck,
        label: 'Validations',
        state: 'pending',
        primaryText: 'Not yet available',
        secondaryText: 'Validations run after photos are uploaded.',
      }
    }
    if (globalValidations.length === 0) {
      return {
        icon: ShieldAlert,
        label: 'Validations',
        state: 'warning',
        primaryText: 'Not run yet',
        secondaryText: 'Run validations to verify uploads meet the rules.',
        action: {
          label: 'Run validations',
          onClick: onRunValidations,
          disabled: isRunningValidations,
        },
      }
    }
    if (hasErrors) {
      const errorCount = globalValidations.filter(
        (r) => r.severity === 'error' && r.outcome === 'failed',
      ).length
      return {
        icon: XCircle,
        label: 'Validations',
        state: 'error',
        primaryText: `${errorCount} ${errorCount === 1 ? 'error' : 'errors'} found`,
        secondaryText: 'See the Validation Results tab for details.',
      }
    }
    if (hasWarnings) {
      const warnCount = globalValidations.filter(
        (r) => r.severity === 'warning' && r.outcome === 'failed',
      ).length
      return {
        icon: ShieldAlert,
        label: 'Validations',
        state: 'warning',
        primaryText: `${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`,
        secondaryText: 'Submissions passed but with notes to review.',
      }
    }
    if (allPassed) {
      return {
        icon: CheckCircle2,
        label: 'Validations',
        state: 'ok',
        primaryText: 'All checks passed',
        secondaryText: `${globalValidations.length} checks completed successfully.`,
      }
    }
    return {
      icon: ShieldCheck,
      label: 'Validations',
      state: 'pending',
      primaryText: 'Pending',
    }
  })()

  const contactSheets = participant.contactSheets ?? []
  const hasContactSheet = contactSheets.length > 0
  const isValidPhotoCountForSheet = VALID_CONTACT_SHEET_PHOTO_AMOUNT.includes(submissions.length)

  const contactSheetStage: StageProps = (() => {
    if (isGeneratingContactSheet) {
      return {
        icon: Loader2,
        label: 'Contact sheet',
        state: 'running',
        primaryText: 'Generating…',
        secondaryText: 'This usually takes a few seconds.',
      }
    }
    if (hasContactSheet) {
      return {
        icon: Grid3x3,
        label: 'Contact sheet',
        state: 'ok',
        primaryText: 'Generated',
        secondaryText:
          contactSheets.length > 1
            ? `${contactSheets.length} versions on file.`
            : 'View it under the Contact Sheet tab.',
      }
    }
    if (!hasSubmissions) {
      return {
        icon: Grid3x3,
        label: 'Contact sheet',
        state: 'pending',
        primaryText: 'Not yet available',
        secondaryText: 'Available once photos are uploaded.',
      }
    }
    if (!isValidPhotoCountForSheet) {
      return {
        icon: Grid3x3,
        label: 'Contact sheet',
        state: 'warning',
        primaryText: 'Photo count mismatch',
        secondaryText: `Requires ${VALID_CONTACT_SHEET_PHOTO_AMOUNT.join(' or ')} photos. Has ${submissions.length}.`,
      }
    }
    return {
      icon: Grid3x3,
      label: 'Contact sheet',
      state: 'warning',
      primaryText: 'Not generated',
      secondaryText: 'Generate a printable sheet of all submissions.',
      action: {
        label: 'Generate sheet',
        onClick: onGenerateContactSheet,
        disabled: isGeneratingContactSheet,
      },
    }
  })()

  const hasZip = (participant.zippedSubmissions?.length ?? 0) > 0
  const zipStage: StageProps = (() => {
    if (hasZip) {
      return {
        icon: Archive,
        label: 'Zip file',
        state: 'ok',
        primaryText: 'Generated',
        secondaryText: 'Available for download in exports.',
      }
    }
    if (!hasSubmissions) {
      return {
        icon: Archive,
        label: 'Zip file',
        state: 'pending',
        primaryText: 'Not yet available',
        secondaryText: 'Created from the export action once photos are uploaded.',
      }
    }
    return {
      icon: Archive,
      label: 'Zip file',
      state: 'warning',
      primaryText: 'Not generated',
      secondaryText: 'Use the Export action to package the submissions.',
    }
  })()

  const stages: StageProps[] = [validationStage, contactSheetStage, zipStage]

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {stages.map((stage) => (
          <PipelineStage key={stage.label} {...stage} />
        ))}
      </div>
    </div>
  )
}
