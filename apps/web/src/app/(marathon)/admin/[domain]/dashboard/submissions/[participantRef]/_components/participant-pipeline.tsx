'use client'

import {
  Archive,
  CheckCircle2,
  Grid3x3,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { summarizeValidationResults } from '../_lib/submission-helpers'
import type { ParticipantWithRelations } from '../_lib/utils'

const VALID_CONTACT_SHEET_PHOTO_AMOUNT = [8, 24]

type StageState = 'ok' | 'pending' | 'warning' | 'error' | 'running'

type StageAction = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type RefreshAction = {
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
}

interface StageProps {
  icon: LucideIcon
  label: string
  state: StageState
  primaryText: string
  secondaryText?: string
  primaryAction?: StageAction
  refreshAction?: RefreshAction
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

function PipelineRefreshButton({ refreshAction }: { refreshAction: RefreshAction }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={refreshAction.onClick}
            disabled={refreshAction.disabled}
            aria-label={refreshAction.ariaLabel}
            className="h-7 w-7 shrink-0"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshAction.disabled && 'animate-spin')}
            />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {refreshAction.ariaLabel}
      </TooltipContent>
    </Tooltip>
  )
}

function PipelineStage({
  icon: Icon,
  label,
  state,
  primaryText,
  secondaryText,
  primaryAction,
  refreshAction,
}: StageProps) {
  const styles = stateBadgeStyles[state]
  const hasActions = primaryAction ?? refreshAction

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
        {hasActions ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {primaryAction ? (
              <Button
                variant="outline"
                size="sm"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="h-7 text-[11px] px-2.5"
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {refreshAction ? <PipelineRefreshButton refreshAction={refreshAction} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface ParticipantPipelineProps {
  participant: ParticipantWithRelations
  isRunningValidations: boolean
  onRunValidations: () => void
  onViewValidationResults: () => void
  isGeneratingContactSheet: boolean
  onGenerateContactSheet: () => void
  onShowContactSheet: () => void
  isGeneratingZip: boolean
  onGenerateZip: () => void
  onDownloadZip: () => void
  isDownloadingZip?: boolean
  embedded?: boolean
}

export function ParticipantPipeline({
  participant,
  isRunningValidations,
  onRunValidations,
  onViewValidationResults,
  isGeneratingContactSheet,
  onGenerateContactSheet,
  onShowContactSheet,
  isGeneratingZip,
  onGenerateZip,
  onDownloadZip,
  isDownloadingZip = false,
  embedded = false,
}: ParticipantPipelineProps) {
  const submissions = participant.submissions ?? []
  const hasSubmissions = submissions.length > 0

  const validationResults = participant.validationResults ?? []
  const hasValidationResults = validationResults.length > 0
  const { failed, hasErrors, hasWarnings } = summarizeValidationResults(validationResults)
  const allPassed = hasValidationResults && failed.length === 0

  const validationRefreshAction = hasSubmissions
    ? {
        onClick: onRunValidations,
        disabled: isRunningValidations,
        ariaLabel: hasValidationResults ? 'Rerun validations' : 'Run validations',
      }
    : undefined

  const validationPrimaryAction = hasValidationResults
    ? {
        label: 'View results',
        onClick: onViewValidationResults,
      }
    : undefined

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
    if (!hasValidationResults) {
      return {
        icon: ShieldAlert,
        label: 'Validations',
        state: 'warning',
        primaryText: 'Not run yet',
        secondaryText: 'Run validations to verify uploads meet the rules.',
        refreshAction: validationRefreshAction,
      }
    }
    if (hasErrors) {
      const errorCount = failed.filter((r) => r.severity === 'error').length
      return {
        icon: XCircle,
        label: 'Validations',
        state: 'error',
        primaryText: `${errorCount} ${errorCount === 1 ? 'error' : 'errors'} found`,
        secondaryText: 'Review failed checks in the results view.',
        primaryAction: validationPrimaryAction,
        refreshAction: validationRefreshAction,
      }
    }
    if (hasWarnings) {
      const warnCount = failed.filter((r) => r.severity === 'warning').length
      return {
        icon: ShieldAlert,
        label: 'Validations',
        state: 'warning',
        primaryText: `${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`,
        secondaryText: 'Submissions passed but with notes to review.',
        primaryAction: validationPrimaryAction,
        refreshAction: validationRefreshAction,
      }
    }
    if (allPassed) {
      return {
        icon: CheckCircle2,
        label: 'Validations',
        state: 'ok',
        primaryText: 'All checks passed',
        secondaryText: `${validationResults.length} checks completed successfully.`,
        primaryAction: validationPrimaryAction,
        refreshAction: validationRefreshAction,
      }
    }
    return {
      icon: ShieldCheck,
      label: 'Validations',
      state: 'pending',
      primaryText: 'Pending',
      primaryAction: validationPrimaryAction,
      refreshAction: validationRefreshAction,
    }
  })()

  const contactSheets = participant.contactSheets ?? []
  const hasContactSheet = contactSheets.length > 0
  const isValidPhotoCountForSheet = VALID_CONTACT_SHEET_PHOTO_AMOUNT.includes(submissions.length)

  const contactSheetRefreshAction =
    hasSubmissions && (hasContactSheet || isValidPhotoCountForSheet)
      ? {
          onClick: onGenerateContactSheet,
          disabled: isGeneratingContactSheet,
          ariaLabel: hasContactSheet ? 'Regenerate contact sheet' : 'Generate contact sheet',
        }
      : undefined

  const contactSheetPrimaryAction = hasContactSheet
    ? {
        label: 'Show Sheet',
        onClick: onShowContactSheet,
      }
    : undefined

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
            : 'Open the contact sheet preview.',
        primaryAction: contactSheetPrimaryAction,
        refreshAction: contactSheetRefreshAction,
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
      refreshAction: contactSheetRefreshAction,
    }
  })()

  const hasZip = (participant.zippedSubmissions?.length ?? 0) > 0

  const zipRefreshAction = hasSubmissions
    ? {
        onClick: onGenerateZip,
        disabled: isGeneratingZip,
        ariaLabel: hasZip ? 'Regenerate zip file' : 'Generate zip file',
      }
    : undefined

  const zipPrimaryAction = hasZip
    ? {
        label: 'Download File',
        onClick: onDownloadZip,
        disabled: isDownloadingZip,
      }
    : undefined

  const zipStage: StageProps = (() => {
    if (isGeneratingZip) {
      return {
        icon: Loader2,
        label: 'Zip file',
        state: 'running',
        primaryText: 'Generating…',
        secondaryText: 'Packaging submissions into a zip archive.',
      }
    }
    if (hasZip) {
      return {
        icon: Archive,
        label: 'Zip file',
        state: 'ok',
        primaryText: 'Generated',
        secondaryText: 'Download the packaged submissions.',
        primaryAction: zipPrimaryAction,
        refreshAction: zipRefreshAction,
      }
    }
    if (!hasSubmissions) {
      return {
        icon: Archive,
        label: 'Zip file',
        state: 'pending',
        primaryText: 'Not yet available',
        secondaryText: 'Created once photos are uploaded.',
      }
    }
    return {
      icon: Archive,
      label: 'Zip file',
      state: 'warning',
      primaryText: 'Not generated',
      secondaryText: 'Package all submissions into a downloadable zip file.',
      refreshAction: zipRefreshAction,
    }
  })()

  const stages: StageProps[] = [validationStage, contactSheetStage, zipStage]

  const grid = (
    <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
      {stages.map((stage) => (
        <PipelineStage key={stage.label} {...stage} />
      ))}
    </div>
  )

  if (embedded) {
    return <div className="border-t border-border">{grid}</div>
  }

  return <div className="rounded-xl border border-border bg-white">{grid}</div>
}
