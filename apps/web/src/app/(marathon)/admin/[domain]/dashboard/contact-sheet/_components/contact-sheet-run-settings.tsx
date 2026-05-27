'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Check, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/ui/primary-button'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import { cn, formatDomainPathname } from '@/lib/utils'
import { CONTACT_SHEET_FORMATS, type ContactSheetFormatKey } from '@/lib/contact-sheet/constants'

const FORMAT_OPTIONS = Object.entries(CONTACT_SHEET_FORMATS).map(([key, config]) => ({
  key: key as ContactSheetFormatKey,
  ...config,
  aspectRatio: config.width / config.height,
}))

function isContactSheetFormatKey(value: string): value is ContactSheetFormatKey {
  return value in CONTACT_SHEET_FORMATS
}

function FormatPreviewCard({
  formatKey,
  label,
  width,
  height,
  aspectRatio,
  isSelected,
  isPending,
  onSelect,
}: {
  formatKey: ContactSheetFormatKey
  label: string
  width: number
  height: number
  aspectRatio: number
  isSelected: boolean
  isPending: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      aria-pressed={isSelected}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-xl border bg-white text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:ring-offset-2',
        isSelected
          ? 'border-brand-primary ring-2 ring-brand-primary/20'
          : 'border-border hover:border-brand-primary/40 hover:bg-muted/20',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <p className="font-gothic text-lg font-semibold tracking-tight">{label}</p>
          <p
            className="mt-0.5 text-xs text-muted-foreground"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {width.toLocaleString()} × {height.toLocaleString()} px
          </p>
        </div>
        {isSelected ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
            <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="h-6 w-6 shrink-0 rounded-full border-2 border-muted-foreground/25 transition-colors group-hover:border-brand-primary/40"
          />
        )}
      </div>

      <div className="px-4 pb-4">
        <div
          className={cn(
            'mx-auto w-full max-w-[200px] overflow-hidden rounded-md border bg-muted/30',
            isSelected ? 'border-brand-primary/25' : 'border-border/80',
          )}
        >
          <div className="flex w-full items-center justify-center bg-white" style={{ aspectRatio }}>
            <div
              className={cn(
                'grid h-[72%] w-[78%] gap-0.5',
                formatKey === 'classic' ? 'grid-cols-3 grid-rows-3' : 'grid-cols-5 grid-rows-5',
              )}
            >
              {Array.from({
                length: formatKey === 'classic' ? 9 : 25,
              }).map((_, index) => {
                const isSponsor = formatKey === 'classic' ? index === 8 : index === 24

                if (isSponsor) {
                  return (
                    <div
                      key={index}
                      className={cn(
                        'rounded-[1px]',
                        isSelected ? 'bg-brand-primary/25' : 'bg-muted-foreground/15',
                      )}
                    />
                  )
                }

                return (
                  <div
                    key={index}
                    className={cn(
                      'rounded-[1px]',
                      isSelected ? 'bg-brand-primary/12' : 'bg-muted-foreground/10',
                    )}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

export function ContactSheetRunSettings() {
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const savedFormat = isContactSheetFormatKey(marathon.contactSheetFormat)
    ? marathon.contactSheetFormat
    : 'classic'

  const [contactSheetFormat, setContactSheetFormat] = useState<ContactSheetFormatKey>(savedFormat)

  useEffect(() => {
    setContactSheetFormat(savedFormat)
  }, [savedFormat])

  const { mutate: updateMarathon, isPending } = useMutation(
    trpc.marathons.update.mutationOptions({
      onSuccess: () => {
        toast.success('Production contact sheet format saved')
        void queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to save contact sheet format')
      },
    }),
  )

  const isDirty = contactSheetFormat !== savedFormat
  const classesHref = formatDomainPathname('/admin/dashboard/classes', domain)
  const selectedConfig = CONTACT_SHEET_FORMATS[contactSheetFormat]

  const handleSave = () => {
    updateMarathon({
      domain,
      data: { contactSheetFormat },
    })
  }

  return (
    <section className="mt-10 border-t border-border/80 pt-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
            <Upload
              aria-hidden="true"
              className="h-[18px] w-[18px] text-brand-primary"
              strokeWidth={1.8}
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Auto-generated
            </p>
            <h2 className="font-gothic text-xl font-medium leading-none tracking-tight">
              Production contact sheets
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Sheets generated automatically when a participant finishes uploading. This is separate
              from the preview builder above.
            </p>
          </div>
        </div>

        {isDirty ? (
          <p className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
            Unsaved changes
          </p>
        ) : (
          <p className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-800">
            Using {CONTACT_SHEET_FORMATS[savedFormat].label}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((option) => (
            <FormatPreviewCard
              key={option.key}
              formatKey={option.key}
              label={option.label}
              width={option.width}
              height={option.height}
              aspectRatio={option.aspectRatio}
              isSelected={contactSheetFormat === option.key}
              isPending={isPending}
              onSelect={() => setContactSheetFormat(option.key)}
            />
          ))}
        </div>

        <aside className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-muted/15 p-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Photo count</span> (8 or 24) comes from
              each participant&apos;s{' '}
              <Link
                href={classesHref}
                className="font-medium text-brand-primary underline-offset-2 hover:underline"
              >
                competition class
              </Link>
              , not this setting.
            </p>
            <p>
              <span className="font-medium text-foreground">New uploads</span> use the format you
              save here. Already generated sheets stay as they are until you regenerate them from a
              participant page.
            </p>
          </div>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Selected:{' '}
              <span className="font-medium text-foreground">
                {selectedConfig.label} ({selectedConfig.width} × {selectedConfig.height})
              </span>
            </p>
            <PrimaryButton
              type="button"
              className="w-full"
              disabled={!isDirty || isPending}
              onClick={handleSave}
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Save production format'
              )}
            </PrimaryButton>
          </div>
        </aside>
      </div>
    </section>
  )
}
