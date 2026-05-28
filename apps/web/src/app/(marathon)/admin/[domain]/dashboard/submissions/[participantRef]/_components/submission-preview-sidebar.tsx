'use client'

import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Aperture,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCode,
  Gauge,
  Info,
  MapPin,
  Maximize2,
  Ruler,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import type { Submission, ValidationResult } from '@blikka/db'
import { cn } from '@/lib/utils'
import {
  formatCompactExifValue,
  formatExposure,
  humanizeExifKey,
} from '../_lib/exif-format'
import {
  formatRuleKey,
  getExifRecord,
  getSubmissionCaptureDate,
  readExifNumber,
  readExifString,
} from '../_lib/submission-helpers'

interface SubmissionPreviewSidebarProps {
  submission: Submission
  validationResults: ValidationResult[]
  failed: ValidationResult[]
  passedCount: number
  downloadFileName: string
}

export function SubmissionPreviewSidebar({
  submission,
  validationResults,
  failed,
  passedCount,
  downloadFileName,
}: SubmissionPreviewSidebarProps) {
  return (
    <>
      <ValidationSection results={validationResults} failed={failed} passedCount={passedCount} />
      <FileSection submission={submission} downloadFileName={downloadFileName} />
      <ExifSection submission={submission} />
    </>
  )
}

interface SidebarSectionProps {
  title: string
  aside?: ReactNode
  children: ReactNode
  last?: boolean
}

function SidebarSection({ title, aside, children, last }: SidebarSectionProps) {
  return (
    <section className={cn('px-4 py-4', !last && 'border-b border-border/70')}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-gothic text-[12px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

interface ValidationSectionProps {
  results: ValidationResult[]
  failed: ValidationResult[]
  passedCount: number
}

function ValidationSection({ results, failed, passedCount }: ValidationSectionProps) {
  if (results.length === 0) {
    return (
      <SidebarSection title="Validation">
        <p className="text-xs text-muted-foreground">No validation has been run yet.</p>
      </SidebarSection>
    )
  }

  return (
    <SidebarSection
      title="Validation"
      aside={
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {passedCount}/{results.length} passed
        </span>
      }
    >
      {failed.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/8 px-2.5 py-2 text-[12px] text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
          All {results.length} checks passed
        </div>
      ) : (
        <ul className="space-y-1.5">
          {failed.map((result, idx) => (
            <li
              key={`${result.ruleKey}-${idx}`}
              className={cn(
                'flex items-start gap-2 rounded-md border px-2.5 py-2 text-[12px] leading-snug',
                result.severity === 'error'
                  ? 'border-red-500/25 bg-red-500/8 text-red-800'
                  : 'border-amber-500/30 bg-amber-500/8 text-amber-800',
              )}
            >
              {result.severity === 'error' ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
              )}
              <div className="min-w-0">
                <p className="font-medium">{formatRuleKey(result.ruleKey)}</p>
                {result.message ? (
                  <p className="text-[11.5px] opacity-85">{result.message}</p>
                ) : null}
              </div>
            </li>
          ))}
          {passedCount > 0 ? (
            <li className="pt-0.5 text-[10.5px] text-muted-foreground">
              {passedCount} other {passedCount === 1 ? 'check' : 'checks'} passed
            </li>
          ) : null}
        </ul>
      )}
    </SidebarSection>
  )
}

interface FileSectionProps {
  submission: Submission
  downloadFileName: string
}

function FileSection({ submission, downloadFileName }: FileSectionProps) {
  const width = readExifNumber(submission.exif, 'ImageWidth')
  const height = readExifNumber(submission.exif, 'ImageHeight')
  const captureDate = getSubmissionCaptureDate(submission)

  return (
    <SidebarSection title="File">
      <div className="space-y-1.5 text-[11.5px]">
        <div className="flex items-center gap-1.5 break-all font-mono text-foreground">
          {downloadFileName}
        </div>
        {width && height ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Maximize2 className="h-3 w-3" />
            {width} × {height}
          </div>
        ) : null}
        <div className="flex gap-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <UploadCloud className="h-3 w-3" />
            Submitted {format(new Date(submission.createdAt), 'MMM d, HH:mm')}
          </div>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Captured {captureDate ? format(captureDate, 'MMM d, HH:mm') : 'Unknown'}
          </div>
        </div>
      </div>
    </SidebarSection>
  )
}

function ExifSection({ submission }: { submission: Submission }) {
  const exif = submission.exif
  const [showAll, setShowAll] = useState(false)
  const make = readExifString(exif, 'Make')
  const model = readExifString(exif, 'Model')
  const lens = readExifString(exif, 'LensModel')
  const exposureTime = readExifNumber(exif, 'ExposureTime')
  const fNumber = readExifNumber(exif, 'FNumber')
  const iso = readExifNumber(exif, 'ISO')
  const focalLength = readExifNumber(exif, 'FocalLength')

  const cameraLabel = [make, model].filter(Boolean).join(' ').trim()
  const exifRecord = getExifRecord(exif)
  const totalKeys = Object.keys(exifRecord).length

  const latitude = readExifNumber(exif, 'latitude') ?? readExifNumber(exif, 'GPSLatitude')
  const longitude = readExifNumber(exif, 'longitude') ?? readExifNumber(exif, 'GPSLongitude')
  const hasGps = latitude !== null && longitude !== null

  const exposureSettings = [
    exposureTime !== null
      ? { icon: Clock, label: 'Shutter', value: formatExposure(exposureTime) }
      : null,
    fNumber !== null
      ? { icon: Aperture, label: 'Aperture', value: `f/${fNumber.toFixed(1)}` }
      : null,
    iso !== null ? { icon: Gauge, label: 'ISO', value: String(iso) } : null,
    focalLength !== null ? { icon: Ruler, label: 'Focal', value: `${focalLength}mm` } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const hasSummary = Boolean(cameraLabel || lens || exposureSettings.length > 0 || hasGps)

  if (!hasSummary && totalKeys === 0) {
    return (
      <SidebarSection title="EXIF" last>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-[12px] text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>No EXIF metadata was extracted from this file.</p>
        </div>
      </SidebarSection>
    )
  }

  return (
    <SidebarSection
      title="EXIF"
      last
      aside={
        totalKeys > 0 ? (
          <span className="font-mono text-[10.5px] text-muted-foreground">{totalKeys} fields</span>
        ) : null
      }
    >
      {hasSummary ? (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-white">
          {cameraLabel || lens ? (
            <div className="flex items-start gap-3 px-3.5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f2]">
                <Camera className="h-4 w-4 text-foreground/70" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                {cameraLabel ? (
                  <p className="truncate text-[13px] font-medium leading-snug text-foreground">
                    {cameraLabel}
                  </p>
                ) : null}
                {lens ? (
                  <p
                    className={cn(
                      'truncate text-[11.5px] leading-snug text-muted-foreground',
                      cameraLabel && 'mt-0.5',
                    )}
                  >
                    {lens}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {exposureSettings.length > 0 ? (
            <div
              className={cn(
                'grid grid-cols-2 gap-px bg-border/50',
                exposureSettings.length === 3 && 'grid-cols-3',
                exposureSettings.length === 4 && 'grid-cols-4',
                (cameraLabel || lens) && 'border-t border-border/50',
              )}
            >
              {exposureSettings.map((setting) => (
                <div
                  key={setting.label}
                  className="flex flex-col items-center gap-1 bg-white px-2 py-2.5 text-center"
                >
                  <setting.icon className="h-3 w-3 text-muted-foreground/70" strokeWidth={2.2} />
                  <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {setting.label}
                  </span>
                  <span className="font-mono text-[12px] font-medium leading-none text-foreground">
                    {setting.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {hasGps ? (
            <div
              className={cn(
                'flex items-center gap-2 border-t border-border/50 px-3.5 py-2 text-[11.5px] text-muted-foreground',
                (cameraLabel || lens || exposureSettings.length > 0) && 'bg-[#fafaf8]',
              )}
            >
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.2} />
              <span className="font-mono tabular-nums">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {totalKeys > 0 ? (
        <div className={cn(hasSummary && 'mt-3')}>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-expanded={showAll}
          >
            <span className="inline-flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              {showAll ? 'Hide raw metadata' : 'Raw metadata'}
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-180')}
            />
          </button>
          {showAll ? (
            <div className="mt-1.5 rounded-lg border border-border/60 bg-white">
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.keys(exifRecord)
                    .toSorted((a, b) => a.localeCompare(b))
                    .map((key) => (
                      <tr key={key} className="border-b border-border/40 last:border-0">
                        <td className="w-[42%] px-2.5 py-1.5 align-top text-muted-foreground">
                          {humanizeExifKey(key)}
                        </td>
                        <td className="break-all px-2.5 py-1.5 text-right font-mono text-foreground">
                          {formatCompactExifValue(key, exifRecord[key])}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </SidebarSection>
  )
}
