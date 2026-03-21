"use client"

import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Archive, AlertCircle, FileSpreadsheet } from "lucide-react"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { getByCameraExportAccessState } from "@/lib/by-camera/by-camera-export-access-state"
import { ExportHeader } from "./export-header"
import { ExportCard } from "./export-card"
import { BY_CAMERA_EXPORT_TYPES, MARATHON_EXPORT_TYPES } from "../_lib/utils"
import { FullMarathonZipCard } from "./full-marathon-zip-card"
import { TopicImagesZipCard } from "./topic-images-zip-card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function ExportContent() {
  const domain = useDomain()
  const trpc = useTRPC()
  const [bypassRestriction, setBypassRestriction] = useState(false)

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const isLive = (() => {
    if (!marathon.startDate || !marathon.endDate) return false
    const now = new Date()
    const startDate = new Date(marathon.startDate)
    const endDate = new Date(marathon.endDate)
    return now >= startDate && now <= endDate
  })()

  const isDevelopment = process.env.NODE_ENV === "development"
  const isByCamera = marathon.mode === "by-camera"
  const byCameraExportAccess = isByCamera ? getByCameraExportAccessState(marathon) : null
  const activeTopic = byCameraExportAccess?.activeTopic ?? null
  const exportTypes = isByCamera ? BY_CAMERA_EXPORT_TYPES : MARATHON_EXPORT_TYPES
  const shouldDisableExports = isByCamera
    ? !(byCameraExportAccess?.isExportAllowed ?? false)
    : isLive && !bypassRestriction

  if (!marathon) return null

  return (
    <div>
      <ExportHeader
        domain={domain}
        marathonName={marathon.name}
        exportCount={exportTypes.length + 1}
      />

      {isByCamera && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-border bg-white p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
            <Archive className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">
              {activeTopic ? `Active topic: ${activeTopic.name}` : "By-camera exports"}
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
              Exports on this page are scoped to the active topic only. The ZIP download contains the
              original uploaded images for that topic in one flat archive.
            </p>
          </div>
        </div>
      )}

      {!isByCamera && isLive && isDevelopment && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
          <Switch
            id="bypass-export-restriction"
            checked={bypassRestriction}
            onCheckedChange={setBypassRestriction}
          />
          <Label
            htmlFor="bypass-export-restriction"
            className="text-sm font-medium text-amber-900 cursor-pointer"
          >
            Bypass export restriction (dev only)
          </Label>
        </div>
      )}

      {shouldDisableExports && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
            <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-red-900">
              {isByCamera
                ? (byCameraExportAccess?.message?.title ?? "Exports unavailable")
                : "Exports unavailable"}
            </p>
            <p className="text-[13px] text-red-800/80 leading-relaxed mt-0.5">
              {isByCamera
                ? (byCameraExportAccess?.message?.description ??
                  "Exports are unavailable for the active topic right now.")
                : "Exports are not available while the marathon is live. Please wait until the marathon ends to generate exports."}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-10">
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Spreadsheets &amp; Reports
            </p>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-md">
            Structured data exports for participants, submissions, and validation results.
          </p>
          <div className="space-y-3">
            {exportTypes.map((exportType) => (
              <ExportCard
                key={exportType.id}
                title={exportType.title}
                description={exportType.description}
                icon={<exportType.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                exportType={exportType.exportType}
                downloadName={exportType.downloadName}
                formatOptions={exportType.formatOptions}
                validationOptions={exportType.validationOptions}
                fileFormatOptions={exportType.fileFormatOptions}
                disabled={shouldDisableExports}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Archives
            </p>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-md">
            Bulk download original submission files as ZIP archives.
          </p>
          <div className="space-y-3">
            {isByCamera ? (
              <TopicImagesZipCard
                disabled={shouldDisableExports}
                topicName={activeTopic?.name ?? null}
              />
            ) : (
              <FullMarathonZipCard disabled={shouldDisableExports} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
