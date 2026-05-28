'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Download,
  Grid3x3,
  Loader2,
  RefreshCw,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import { buildS3Url, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { downloadRemoteUrl } from '../[submissionId]/_lib/download-remote-url'

const VALID_CONTACT_SHEET_PHOTO_AMOUNT = [8, 24]

const CONTACT_SHEETS_BUCKET_NAME = process.env.NEXT_PUBLIC_CONTACT_SHEETS_BUCKET_NAME

const EMPTY_PANEL_TONE = {
  neutral: {
    iconBg: 'bg-brand-primary/10',
    iconColor: 'text-brand-primary',
  },
  warning: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
  },
} as const

type ContactSheetTabProps = {
  participantRef: string
}

type EmptyPanelProps = {
  icon: LucideIcon
  title: string
  description: string
  tone?: keyof typeof EMPTY_PANEL_TONE
  action?: ReactNode
}

type ButtonIconLabelProps = {
  pending: boolean
  icon: LucideIcon
  label: string
  pendingLabel: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function ButtonIconLabel({ pending, icon: Icon, label, pendingLabel }: ButtonIconLabelProps) {
  if (pending) {
    return (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {pendingLabel}
      </>
    )
  }

  return (
    <>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </>
  )
}

function EmptyPanel({ icon: Icon, title, description, tone = 'neutral', action }: EmptyPanelProps) {
  const toneStyles = EMPTY_PANEL_TONE[tone]

  return (
    <div className="flex min-w-0 w-full flex-col items-stretch justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center sm:px-6 sm:py-14">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl',
            toneStyles.iconBg,
          )}
        >
          <Icon className={cn('size-6', toneStyles.iconColor)} />
        </div>
        <h2 className="font-gothic text-xl tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="mx-auto mt-2 min-w-0 max-w-lg text-balance text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ContactSheetTab({ participantRef }: ContactSheetTabProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    }),
  )

  const generateContactSheetMutation = useMutation(
    trpc.contactSheets.generateContactSheet.mutationOptions(),
  )

  const sortedContactSheets = useMemo(
    () =>
      [...participant.contactSheets].toSorted(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [participant.contactSheets],
  )

  const hasContactSheet = sortedContactSheets.length > 0
  const canGenerate = participant.status === 'completed' || participant.status === 'verified'
  const submissionCount = participant.submissions.length
  const isValidAmountOfPhotos = VALID_CONTACT_SHEET_PHOTO_AMOUNT.includes(submissionCount)
  const selectedContactSheet = sortedContactSheets[selectedSheetIndex] ?? sortedContactSheets[0]

  const handleGenerateContactSheet = () => {
    generateContactSheetMutation.mutate(
      {
        domain,
        reference: participantRef,
      },
      {
        onSuccess: () => {
          toast.success('Contact sheet generated successfully')
          setSelectedSheetIndex(0)
          queryClient.invalidateQueries({ queryKey: trpc.contactSheets.pathKey() })
          queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to generate contact sheet'))
        },
      },
    )
  }

  const handleDownloadContactSheet = async () => {
    if (!selectedContactSheet) return

    try {
      setIsDownloading(true)
      await downloadRemoteUrl(
        buildS3Url(CONTACT_SHEETS_BUCKET_NAME, selectedContactSheet.key) ?? '',
        `contact-sheet-${participantRef}.jpg`,
      )
      toast.success('Contact sheet downloaded')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to download contact sheet'))
    } finally {
      setIsDownloading(false)
    }
  }

  if (participant.status === 'prepared') {
    return (
      <EmptyPanel
        icon={Upload}
        title="Not available yet"
        description="Contact sheets can be generated once the participant has uploaded their photos."
      />
    )
  }

  if (!hasContactSheet && !isValidAmountOfPhotos) {
    return (
      <EmptyPanel
        icon={AlertTriangle}
        title="Photo count mismatch"
        description={`Contact sheets require ${VALID_CONTACT_SHEET_PHOTO_AMOUNT.join(' or ')} photos. This participant has ${submissionCount}.`}
        tone="warning"
      />
    )
  }

  if (hasContactSheet && selectedContactSheet) {
    const generatedAt = format(new Date(selectedContactSheet.createdAt), 'MMM d, yyyy · h:mm a')
    const contactSheetUrl = buildS3Url(CONTACT_SHEETS_BUCKET_NAME, selectedContactSheet.key) ?? ''

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Grid3x3 className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Contact sheet ready</h3>
                <p className="text-xs text-muted-foreground">Generated {generatedAt}</p>
              </div>
            </div>
            {sortedContactSheets.length > 1 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Versions
                </span>
                {sortedContactSheets.map((sheet, index) => (
                  <Button
                    key={sheet.id}
                    type="button"
                    variant={selectedSheetIndex === index ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => setSelectedSheetIndex(index)}
                  >
                    {index === 0 ? 'Latest' : `v${sortedContactSheets.length - index}`}
                    <span className="ml-1 hidden text-muted-foreground sm:inline">
                      · {format(new Date(sheet.createdAt), 'MMM d')}
                    </span>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadContactSheet}
              disabled={isDownloading}
            >
              <ButtonIconLabel
                pending={isDownloading}
                icon={Download}
                label="Download"
                pendingLabel="Downloading…"
              />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateContactSheet}
              disabled={generateContactSheetMutation.isPending}
            >
              <ButtonIconLabel
                pending={generateContactSheetMutation.isPending}
                icon={RefreshCw}
                label="Regenerate"
                pendingLabel="Regenerating…"
              />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
          <div className="flex items-center justify-between border-b border-border bg-white px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <Badge variant="secondary" className="text-[10px] font-medium">
              {submissionCount} photos
            </Badge>
          </div>
          <div className="flex justify-center bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f4f4f5_75%),linear-gradient(-45deg,transparent_75%,#f4f4f5_75%)] bg-size-[16px_16px] bg-position-[0_0,0_8px,8px_-8px,-8px_0px] p-4 sm:p-6">
            <img
              src={contactSheetUrl}
              alt={`Contact sheet for participant ${participantRef}`}
              className="max-w-full h-auto rounded-md border border-border/80 bg-white shadow-sm"
            />
          </div>
        </div>
      </div>
    )
  }

  if (canGenerate) {
    return (
      <EmptyPanel
        icon={Grid3x3}
        title="No contact sheet yet"
        description="Generate a printable grid of all submissions. This is usually done after validations pass."
        action={
          <Button
            onClick={handleGenerateContactSheet}
            disabled={generateContactSheetMutation.isPending}
          >
            <ButtonIconLabel
              pending={generateContactSheetMutation.isPending}
              icon={Grid3x3}
              label="Generate contact sheet"
              pendingLabel="Generating…"
            />
          </Button>
        }
      />
    )
  }

  return (
    <EmptyPanel
      icon={Grid3x3}
      title="Nothing to show"
      description="A contact sheet will appear here once this participant is ready for processing."
    />
  )
}
