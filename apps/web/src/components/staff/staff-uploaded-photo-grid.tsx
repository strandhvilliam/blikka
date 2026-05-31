'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { PreviewDialog } from '@/components/staff/preview-dialog'
import { findActiveTopic } from '@/lib/by-camera/by-camera-active-topic'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import { useStaffUploadStore } from '@/lib/staff/staff-upload-store'
import { getSelectedTopics } from '@/lib/upload-utils'
import type { UploadMarathonMode } from '@/lib/types'

export function StaffUploadedPhotoGrid() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  const uploadFiles = useStaffUploadStore((state) => state.uploadFiles)
  const existingParticipant = useStaffUploadStore((state) => state.existingParticipant)
  const formValues = useStaffUploadStore((state) => state.formValues)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const uploadedPhotos = uploadFiles.toSorted((a, b) => a.orderIndex - b.orderIndex)
  if (uploadedPhotos.length === 0) {
    return null
  }

  const marathonMode = marathon.mode as UploadMarathonMode
  const sortedTopics = marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex)
  const activeByCameraTopic = findActiveTopic(sortedTopics)

  const activeCompetitionClassId = existingParticipant
    ? String(existingParticipant.competitionClassId)
    : formValues.competitionClassId
  const selectedCompetitionClass =
    marathon.competitionClasses.find((cc) => cc.id === Number(activeCompetitionClassId)) ?? null

  const selectedTopics = getSelectedTopics(
    marathonMode,
    activeByCameraTopic,
    selectedCompetitionClass,
    sortedTopics,
  )
  const topicNameByOrderIndex = new Map(
    selectedTopics.map((topic) => [topic.orderIndex, topic.name]),
  )

  const gridColsClass =
    uploadedPhotos.length === 1
      ? 'grid-cols-1 sm:max-w-[200px]'
      : 'grid-cols-2 sm:grid-cols-4'

  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Uploaded photos</p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700">
            {uploadedPhotos.length}
          </span>
        </div>

        <div className={`grid gap-2 ${gridColsClass}`}>
          {uploadedPhotos.map((photo) => {
            const topicName =
              topicNameByOrderIndex.get(photo.orderIndex) ?? `Photo ${photo.orderIndex + 1}`

            return (
              <button
                key={photo.id}
                type="button"
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted text-left"
                onClick={() => setPreviewUrl(photo.previewUrl)}
              >
                <img
                  src={photo.previewUrl}
                  alt={topicName}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8">
                  <p className="truncate text-[11px] font-medium text-white">
                    #{photo.orderIndex + 1} {topicName}
                  </p>
                </div>
                <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <PreviewDialog
        open={previewUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null)
        }}
        imageUrl={previewUrl}
      />
    </>
  )
}
