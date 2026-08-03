'use client'
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Info, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { PhotoReorderBanner } from '@/components/photos/photo-reorder-banner'
import { PhotoReorderControls } from '@/components/photos/photo-reorder-controls'
import { cn } from '@/lib/utils'
import { canReorderPhotos, sortPhotosByOrderIndex } from '@/lib/flow/photo-ordering'
import { getCapturedAtDate, getRelevantExifData } from '@/lib/exif-parsing'
import type { ParticipantSelectedPhoto } from '@/lib/participant-upload-types'
import type { ValidationResult } from '@blikka/validation'
import { VALIDATION_OUTCOME } from '@blikka/validation'
import type { Topic } from '@blikka/db'

interface StaffPhotoListProps {
  photos: ParticipantSelectedPhoto[]
  expectedCount: number
  topics: Topic[]
  photoValidationMap: Map<string, ValidationResult[]>
  isBusy: boolean
  onRemove: (photoId: string) => void
  onMovePhoto?: (displayIndex: number, direction: 'up' | 'down') => void
}

type PhotoStatus = 'ok' | 'warning' | 'error'

function getPhotoStatus(validations: ValidationResult[]): PhotoStatus {
  const hasError = validations.some(
    (r) => r.outcome === VALIDATION_OUTCOME.FAILED && r.severity === 'error',
  )
  if (hasError) return 'error'

  const hasWarning = validations.some(
    (r) => r.outcome === VALIDATION_OUTCOME.FAILED && r.severity === 'warning',
  )
  if (hasWarning) return 'warning'

  return 'ok'
}

const STATUS_BORDER: Record<PhotoStatus, string> = {
  ok: 'border-border',
  warning: 'border-amber-300',
  error: 'border-rose-300',
}

const STATUS_LABEL: Record<PhotoStatus, { text: string; className: string } | null> = {
  ok: null,
  warning: { text: 'Warning', className: 'text-amber-600 bg-amber-50 border-amber-200' },
  error: { text: 'Issue found', className: 'text-rose-600 bg-rose-50 border-rose-200' },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatCaptureDate(date: Date): string | null {
  try {
    if (Number.isNaN(date.getTime())) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}`
  } catch {
    return null
  }
}

export function StaffPhotoList({
  photos,
  expectedCount,
  topics,
  photoValidationMap,
  isBusy,
  onRemove,
  onMovePhoto,
}: StaffPhotoListProps) {
  const t = useTranslations('FlowPage.uploadStep')
  const topicsByOrderIndex = useMemo(
    () => new Map(topics.map((topic) => [topic.orderIndex, topic])),
    [topics],
  )
  const sortedPhotos = useMemo(() => sortPhotosByOrderIndex(photos), [photos])
  const showReorderControls = canReorderPhotos(sortedPhotos) && Boolean(onMovePhoto)

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No photos selected yet. Use the area above to add photos.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Selected Photos</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {photos.length} / {expectedCount}
        </span>
      </div>

      {showReorderControls ? (
        <PhotoReorderBanner className="mb-3" message={t('reorderPhotosBannerUpload')} />
      ) : null}

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {sortedPhotos.map((photo, index) => (
            <StaffPhotoListItem
              key={photo.id}
              photo={photo}
              index={index}
              listLength={sortedPhotos.length}
              topicName={topicsByOrderIndex.get(photo.orderIndex)?.name ?? null}
              validations={photoValidationMap.get(photo.id) ?? []}
              isBusy={isBusy}
              onRemove={onRemove}
              onMovePhoto={showReorderControls ? onMovePhoto : undefined}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

interface StaffPhotoListItemProps {
  photo: ParticipantSelectedPhoto
  index: number
  listLength: number
  topicName: string | null
  validations: ValidationResult[]
  isBusy: boolean
  onRemove: (photoId: string) => void
  onMovePhoto?: (displayIndex: number, direction: 'up' | 'down') => void
}

function StaffPhotoListItem({
  photo,
  index,
  listLength,
  topicName,
  validations,
  isBusy,
  onRemove,
  onMovePhoto,
}: StaffPhotoListItemProps) {
  const t = useTranslations('FlowPage.uploadStep')
  const [expanded, setExpanded] = useState(false)
  const reduceMotion = useReducedMotion()

  const status = getPhotoStatus(validations)
  const statusLabel = STATUS_LABEL[status]
  const captureDate = getCapturedAtDate(photo.exif)
  const captureDateFormatted = captureDate ? formatCaptureDate(captureDate) : null
  const hasCaptureTime = captureDate !== null
  const relevantExifData = getRelevantExifData(photo.exif)
  const hasExifData = Object.keys(relevantExifData).length > 0

  return (
    <motion.div
      // Position-only: reorder and removal still animate, but expanding the
      // details panel no longer scale-distorts the card's contents.
      layout="position"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
      transition={{ duration: 0.15 }}
      className={cn('group overflow-hidden rounded-xl border bg-card', STATUS_BORDER[status])}
    >
      <div className="flex items-start gap-4 px-3 py-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
          {photo.previewUrl ? (
            <img
              src={photo.previewUrl}
              alt={photo.file.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="px-1.5 text-center">
              <p className="text-[10px] leading-tight text-muted-foreground">
                {photo.previewSkipReason === 'large-file'
                  ? t('previewSkippedLarge')
                  : t('previewUnavailable')}
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground sm:text-lg">
                #{photo.orderIndex + 1}
                {topicName ? (
                  <span className="font-normal text-muted-foreground"> &mdash; {topicName}</span>
                ) : null}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{photo.file.name}</p>
            </div>

            <div className="flex shrink-0 items-start gap-1">
              {onMovePhoto ? (
                <PhotoReorderControls
                  displayIndex={index}
                  isFirst={index === 0}
                  isLast={index === listLength - 1}
                  moveUpLabel={t('movePhotoUp', { index: index + 1 })}
                  moveDownLabel={t('movePhotoDown', { index: index + 1 })}
                  onMove={(direction) => onMovePhoto(index, direction)}
                />
              ) : null}
              {!isBusy ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600"
                  onClick={() => onRemove(photo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {formatFileSize(photo.file.size)}
            {captureDateFormatted ? (
              <>
                <span className="mx-1.5">&middot;</span>
                Taken {captureDateFormatted}
              </>
            ) : null}
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {statusLabel ? (
              <span
                className={cn(
                  'inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  statusLabel.className,
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    status === 'error' ? 'bg-rose-500' : 'bg-amber-500',
                  )}
                />
                {statusLabel.text}
              </span>
            ) : null}
            {!hasCaptureTime ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                {t('noExifData')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {hasExifData ? (
        <div className="border-t border-dashed border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-center gap-1.5 rounded-none px-3 py-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50 focus-visible:text-foreground focus-visible:ring-0"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <Info className="size-3.5 opacity-60" strokeWidth={2} aria-hidden />
            <span className="text-xs font-medium tracking-wide">{t('photoDetails')}</span>
            <ChevronDown
              className={cn(
                'size-3.5 opacity-60 transition-transform duration-200 motion-reduce:transition-none',
                expanded && 'rotate-180',
              )}
              strokeWidth={2}
              aria-hidden
            />
          </Button>
        </div>
      ) : null}

      {expanded && hasExifData ? (
        <div className="border-t border-dashed border-border px-4 pb-3">
          <table className="mt-2 w-full text-xs">
            <tbody>
              {Object.entries(relevantExifData).map(([key, value]) => (
                <tr key={key} className="border-b border-border/50 last:border-b-0">
                  <td className="py-1.5 font-medium text-muted-foreground">{key}</td>
                  <td className="py-1.5 text-right text-foreground">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </motion.div>
  )
}
