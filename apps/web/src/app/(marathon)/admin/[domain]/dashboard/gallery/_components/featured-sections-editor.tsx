'use client'

import Image from 'next/image'
import { useEffect, useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImageOff,
  Loader2,
  Plus,
  Sparkles,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PrimaryButton } from '@/components/ui/primary-button'
import { buildS3Url, cn } from '@/lib/utils'
import { useTRPC } from '@/lib/trpc/client'
import { revalidateGalleryPageCache } from '@/lib/gallery-page-cache.actions'
import type { AvailableFeaturedSection, FeaturedSectionConfig } from './gallery-admin-types'

const MAX_PICKS = 3
const THUMBNAIL_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME

function thumbnailUrl(thumbnailKey: string | null | undefined): string | null {
  if (thumbnailKey && THUMBNAIL_BUCKET) {
    return buildS3Url(THUMBNAIL_BUCKET, thumbnailKey) ?? null
  }
  return null
}

const MEDAL = [
  { label: '1st', ring: 'bg-amber-400/15 text-amber-600 ring-amber-400/30' },
  { label: '2nd', ring: 'bg-slate-400/15 text-slate-500 ring-slate-400/30' },
  { label: '3rd', ring: 'bg-orange-500/15 text-orange-700 ring-orange-500/30' },
] as const

type EditorRow = {
  key: string
  kind: AvailableFeaturedSection['kind']
  title: string
  topicId?: number
  competitionClassId?: number
  enabled: boolean
  order: number
  picks: string[]
}

function sectionKey(section: {
  kind: string
  topicId?: number
  competitionClassId?: number
}): string {
  return `${section.kind}:${section.topicId ?? ''}:${section.competitionClassId ?? ''}`
}

function padPicks(picks: readonly string[] | undefined): string[] {
  const next = [...(picks ?? [])].slice(0, MAX_PICKS)
  while (next.length < MAX_PICKS) next.push('')
  return next
}

function buildRows(
  available: AvailableFeaturedSection[],
  current: FeaturedSectionConfig[],
): EditorRow[] {
  const currentByKey = new Map(current.map((section) => [sectionKey(section), section]))

  const rows: EditorRow[] = available.map((section) => {
    const existing = currentByKey.get(sectionKey(section))
    return {
      key: sectionKey(section),
      kind: section.kind,
      title: section.title,
      topicId: section.topicId,
      competitionClassId: section.competitionClassId,
      enabled: existing?.enabled ?? false,
      order: existing?.order ?? Number.MAX_SAFE_INTEGER,
      picks: padPicks(existing?.picks),
    }
  })

  return rows.toSorted((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    if (a.enabled && b.enabled) return a.order - b.order
    return a.title.localeCompare(b.title)
  })
}

function cleanPicks(picks: readonly string[]): string[] {
  return picks.map((pick) => pick.trim()).filter(Boolean)
}

function signature(rows: EditorRow[], variant: 'palette' | 'single'): string {
  if (variant === 'single') {
    const row = rows[0]
    return JSON.stringify(row ? cleanPicks(row.picks) : [])
  }
  return JSON.stringify(
    rows
      .filter((row) => row.enabled)
      .toSorted((a, b) => a.order - b.order)
      .map((row, index) => ({
        key: row.key,
        order: index,
        picks: cleanPicks(row.picks),
      })),
  )
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function FeaturedSectionsEditor({
  domain,
  topicId,
  topicOrderIndex,
  available,
  current,
  variant = 'palette',
}: {
  domain: string
  topicId: number | null
  topicOrderIndex?: number
  available: AvailableFeaturedSection[]
  current: FeaturedSectionConfig[]
  /** `palette` shows the add/arrange UI (marathon). `single` renders one inline section (by-camera). */
  variant?: 'palette' | 'single'
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const initialRows = useMemo(() => buildRows(available, current), [available, current])
  const [rows, setRows] = useState<EditorRow[]>(initialRows)
  const [baseline, setBaseline] = useState(() => signature(initialRows, variant))

  // Re-sync local edits when the server-provided config changes (e.g. after a save).
  const [syncedInitial, setSyncedInitial] = useState(initialRows)
  if (syncedInitial !== initialRows) {
    setSyncedInitial(initialRows)
    setRows(initialRows)
    setBaseline(signature(initialRows, variant))
  }

  const mutation = useMutation(
    trpc.gallery.updateFeaturedSections.mutationOptions({
      onSuccess: async () => {
        toast.success('Featured winners saved')
        setBaseline(signature(rows, variant))
        await revalidateGalleryPageCache({ domain, topicOrderIndex })
        await queryClient.invalidateQueries({
          queryKey: trpc.gallery.getGalleryAdminState.pathKey(),
        })
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to save featured winners')
      },
    }),
  )

  const enabledRows = rows.filter((row) => row.enabled)
  const availableRows = rows.filter((row) => !row.enabled)
  const isDirty = signature(rows, variant) !== baseline

  const feature = (key: string) => {
    setRows((current) => {
      const maxOrder = current.reduce(
        (max, row) => (row.enabled ? Math.max(max, row.order) : max),
        -1,
      )
      return current.map((row) =>
        row.key === key ? { ...row, enabled: true, order: maxOrder + 1 } : row,
      )
    })
  }

  const unfeature = (key: string) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, enabled: false } : row)))
  }

  const setPick = (key: string, index: number, value: string) => {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        const picks = [...row.picks]
        picks[index] = value.replace(/\s+/g, '')
        return { ...row, picks }
      }),
    )
  }

  const move = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const enabled = current.filter((row) => row.enabled).toSorted((a, b) => a.order - b.order)
      const disabled = current.filter((row) => !row.enabled)
      const target = index + direction
      if (target < 0 || target >= enabled.length) return current
      const reordered = [...enabled]
      const [moved] = reordered.splice(index, 1)
      if (!moved) return current
      reordered.splice(target, 0, moved)
      return [...reordered.map((row, order) => ({ ...row, order })), ...disabled]
    })
  }

  const toSection = (row: EditorRow, order: number) => ({
    id: row.key,
    kind: row.kind,
    enabled: true,
    order,
    picks: cleanPicks(row.picks),
    ...(row.topicId !== undefined ? { topicId: row.topicId } : {}),
    ...(row.competitionClassId !== undefined ? { competitionClassId: row.competitionClassId } : {}),
  })

  const save = () => {
    if (variant === 'single') {
      const row = rows[0]
      const featuredSections = row && cleanPicks(row.picks).length > 0 ? [toSection(row, 0)] : []
      mutation.mutate({ domain, topicId, featuredSections })
      return
    }
    const featuredSections = enabledRows
      .toSorted((a, b) => a.order - b.order)
      .map((row, index) => toSection(row, index))
    mutation.mutate({ domain, topicId, featuredSections })
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No winner sections are available to feature yet.
      </p>
    )
  }

  // by-camera: one section, rendered inline without the palette chrome.
  if (variant === 'single') {
    const row = rows[0]
    if (!row) return null
    return (
      <div className="space-y-4">
        <SectionPicker
          domain={domain}
          row={row}
          onSetPick={(index, value) => setPick(row.key, index, value)}
        />
        <SaveBar
          isDirty={isDirty}
          isSaving={mutation.isPending}
          onSave={save}
          fullBleed
          flushBottom
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 pt-4 sm:px-5">
      {enabledRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <Sparkles className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-2 text-[13px] font-medium text-foreground">No featured winners yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Pick a section below to feature it, then enter the reference numbers of your top three
            winners.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {enabledRows
            .toSorted((a, b) => a.order - b.order)
            .map((row, index) => (
              <li key={row.key}>
                <FeaturedSectionCard
                  domain={domain}
                  row={row}
                  index={index}
                  total={enabledRows.length}
                  onMove={move}
                  onRemove={() => unfeature(row.key)}
                  onSetPick={(slot, value) => setPick(row.key, slot, value)}
                />
              </li>
            ))}
        </ul>
      )}

      {availableRows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Available sections
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => feature(row.key)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5"
              >
                <Plus className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand-primary" />
                {row.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <SaveBar
        isDirty={isDirty}
        isSaving={mutation.isPending}
        onSave={save}
        fullBleed
        flushBottom
      />
    </div>
  )
}

function FeaturedSectionCard({
  domain,
  row,
  index,
  total,
  onMove,
  onRemove,
  onSetPick,
}: {
  domain: string
  row: EditorRow
  index: number
  total: number
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: () => void
  onSetPick: (slot: number, value: string) => void
}) {
  const filled = row.picks.filter((pick) => pick.trim()).length

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
            <Star className="size-3.5 fill-brand-primary text-brand-primary" />
          </div>
          <span className="truncate text-[13px] font-semibold text-foreground">{row.title}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{filled}/3</span>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index <= 0}
            onClick={() => onMove(index, -1)}
            aria-label={`Move ${row.title} up`}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index >= total - 1}
            onClick={() => onMove(index, 1)}
            aria-label={`Move ${row.title} down`}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${row.title} from gallery`}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <SectionPicker domain={domain} row={row} onSetPick={onSetPick} />
    </div>
  )
}

function SectionPicker({
  domain,
  row,
  onSetPick,
}: {
  domain: string
  row: EditorRow
  onSetPick: (slot: number, value: string) => void
}) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-3">
      {row.picks.map((pick, slot) => (
        <ReferenceSlot
          key={slot}
          domain={domain}
          rank={slot}
          value={pick}
          kind={row.kind}
          topicId={row.topicId}
          onChange={(value) => onSetPick(slot, value)}
        />
      ))}
    </div>
  )
}

function ReferenceSlot({
  domain,
  rank,
  value,
  kind,
  topicId,
  onChange,
}: {
  domain: string
  rank: number
  value: string
  kind: AvailableFeaturedSection['kind']
  topicId?: number
  onChange: (value: string) => void
}) {
  const trpc = useTRPC()
  const medal = MEDAL[rank] ?? MEDAL[0]
  const reference = value.trim()
  const debouncedReference = useDebouncedValue(reference, 350)
  const inputId = useId()

  const preview = useQuery(
    trpc.gallery.getGalleryReferencePreview.queryOptions(
      { domain, reference: debouncedReference },
      { enabled: debouncedReference.length > 0, retry: false, staleTime: 60_000 },
    ),
  )

  const isClass = kind === 'class-winners'
  const resolvedSubmission =
    preview.data && !isClass
      ? preview.data.submissions.find((submission) => submission.topicId === topicId)
      : preview.data?.submissions[0]
  const previewUrl = thumbnailUrl(resolvedSubmission?.thumbnailKey)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset',
            medal.ring,
          )}
        >
          {medal.label}
        </span>
        <span className="text-xs text-muted-foreground">place</span>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="flex aspect-[4/3] items-center justify-center">
          {reference.length === 0 ? (
            <span className="text-xs text-muted-foreground">Empty slot</span>
          ) : preview.isFetching ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : preview.isError ? (
            <SlotMessage icon={<TriangleAlert className="size-5" />} tone="warning">
              No finalized participant #{reference}
            </SlotMessage>
          ) : !resolvedSubmission ? (
            <SlotMessage icon={<ImageOff className="size-5" />} tone="warning">
              No photo {isClass ? 'available' : 'for this topic'}
            </SlotMessage>
          ) : previewUrl ? (
            <>
              <Image
                src={previewUrl}
                alt={`Photo by #${reference}`}
                fill
                sizes="200px"
                className="object-cover"
              />
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Check className="size-3" />
                {isClass ? `${preview.data?.submissions.length ?? 0} photos` : 'Match'}
              </span>
            </>
          ) : (
            <SlotMessage icon={<ImageOff className="size-5" />} tone="muted">
              No preview
            </SlotMessage>
          )}
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
          #
        </span>
        <Input
          id={inputId}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Reference"
          aria-label={`${medal.label} place reference number`}
          className="pl-6 font-mono"
        />
      </div>
    </div>
  )
}

function SlotMessage({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode
  tone: 'warning' | 'muted'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 px-3 text-center text-xs',
        tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground',
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  )
}

function SaveBar({
  isDirty,
  isSaving,
  onSave,
  fullBleed = false,
  flushBottom = false,
}: {
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
  fullBleed?: boolean
  flushBottom?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3 sm:px-5',
        fullBleed && '-mx-4 sm:-mx-5',
        flushBottom && '-mb-4 sm:-mb-5',
      )}
    >
      <SaveStatus isDirty={isDirty} isSaving={isSaving} />
      <PrimaryButton type="button" onClick={onSave} disabled={!isDirty || isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          'Save winners'
        )}
      </PrimaryButton>
    </div>
  )
}

function SaveStatus({ isDirty, isSaving }: { isDirty: boolean; isSaving: boolean }) {
  if (isSaving) {
    return <span className="text-xs text-muted-foreground">Saving changes…</span>
  }
  if (isDirty) {
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        Unsaved changes
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      All changes saved
    </span>
  )
}
