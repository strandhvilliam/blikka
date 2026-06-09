'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/lib/trpc/client'
import { revalidateGalleryPageCache } from '@/lib/gallery-page-cache.actions'
import type { AvailableFeaturedSection, FeaturedSectionConfig } from './gallery-admin-types'

type EditorRow = {
  key: string
  kind: AvailableFeaturedSection['kind']
  title: string
  topicId?: number
  competitionClassId?: number
  enabled: boolean
  order: number
}

function sectionKey(section: {
  kind: string
  topicId?: number
  competitionClassId?: number
}): string {
  return `${section.kind}:${section.topicId ?? ''}:${section.competitionClassId ?? ''}`
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
    }
  })

  return rows.toSorted((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    if (a.enabled && b.enabled) return a.order - b.order
    return a.title.localeCompare(b.title)
  })
}

export function FeaturedSectionsEditor({
  domain,
  topicId,
  topicOrderIndex,
  available,
  current,
}: {
  domain: string
  topicId: number | null
  topicOrderIndex?: number
  available: AvailableFeaturedSection[]
  current: FeaturedSectionConfig[]
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const initialRows = useMemo(() => buildRows(available, current), [available, current])
  const [rows, setRows] = useState<EditorRow[]>(initialRows)

  const mutation = useMutation(
    trpc.gallery.updateFeaturedSections.mutationOptions({
      onSuccess: async () => {
        toast.success('Featured sections saved')
        await revalidateGalleryPageCache({ domain, topicOrderIndex })
        await queryClient.invalidateQueries({
          queryKey: trpc.gallery.getGalleryAdminState.pathKey(),
        })
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to save featured sections')
      },
    }),
  )

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  const toggle = (key: string, enabled: boolean) => {
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, enabled } : row))
      return next.toSorted((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        return 0
      })
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const enabledRows = current.filter((row) => row.enabled)
      const disabledRows = current.filter((row) => !row.enabled)
      const target = index + direction
      if (target < 0 || target >= enabledRows.length) return current
      const reordered = [...enabledRows]
      const [moved] = reordered.splice(index, 1)
      if (!moved) return current
      reordered.splice(target, 0, moved)
      return [...reordered, ...disabledRows]
    })
  }

  const save = () => {
    const enabledRows = rows.filter((row) => row.enabled)
    const featuredSections = enabledRows.map((row, index) => ({
      id: row.key,
      kind: row.kind,
      enabled: true,
      order: index,
      ...(row.topicId !== undefined ? { topicId: row.topicId } : {}),
      ...(row.competitionClassId !== undefined
        ? { competitionClassId: row.competitionClassId }
        : {}),
    }))
    mutation.mutate({ domain, topicId, featuredSections })
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No winner sections are available to feature yet.
      </p>
    )
  }

  const enabledRows = rows.filter((row) => row.enabled)

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
        {rows.map((row) => {
          const enabledIndex = enabledRows.findIndex((enabled) => enabled.key === row.key)
          return (
            <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Star
                  className={cn(
                    'size-4 shrink-0',
                    row.enabled ? 'text-amber-500' : 'text-muted-foreground/40',
                  )}
                />
                <span
                  className={cn(
                    'truncate text-sm',
                    row.enabled ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {row.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {row.enabled ? (
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={enabledIndex <= 0}
                      onClick={() => move(enabledIndex, -1)}
                      aria-label={`Move ${row.title} up`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={enabledIndex >= enabledRows.length - 1}
                      onClick={() => move(enabledIndex, 1)}
                      aria-label={`Move ${row.title} down`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                ) : null}
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(checked) => toggle(row.key, checked)}
                  aria-label={`Feature ${row.title}`}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-end">
        <Button onClick={save} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save featured sections'
          )}
        </Button>
      </div>
    </div>
  )
}
