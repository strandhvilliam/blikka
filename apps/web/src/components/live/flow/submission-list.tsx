"use client"

import type { Topic } from "@blikka/db"
import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { buildPhotoValidationMap } from "@/lib/validation"
import { usePhotoStore } from "@/lib/flow/photo-store"
import { SubmissionItem } from "./submission-item"

interface SubmissionListProps {
  topics: Topic[]
  maxPhotos: number
  onUploadClick?: () => void
  onRemovePhoto?: (orderIndex: number) => void
}

export function SubmissionList({
  topics,
  maxPhotos,
  onUploadClick,
  onRemovePhoto,
}: SubmissionListProps) {
  const photos = usePhotoStore((state) => state.photos)
  const validationResults = usePhotoStore((state) => state.validationResults)
  const remainingSlots = maxPhotos - photos.length
  const validationMap = useMemo(
    () => buildPhotoValidationMap(photos, validationResults),
    [photos, validationResults],
  )
  const topicsByOrderIndex = useMemo(
    () => new Map(topics.map((topic) => [topic.orderIndex, topic])),
    [topics],
  )

  return (
    <AnimatePresence>
      <div className="flex flex-col gap-2.5">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <SubmissionItem
              photo={photo}
              topic={topicsByOrderIndex.get(photo.orderIndex) ?? topics[index]}
              validationResults={validationMap.get(photo.id) ?? []}
              index={index}
              onRemove={onRemovePhoto}
            />
          </motion.div>
        ))}
        {Array.from({ length: remainingSlots }).map((_, index) => (
          <motion.div
            key={`empty-${index}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <SubmissionItem
              topic={topics[photos.length + index]}
              index={photos.length + index}
              onUploadClick={onUploadClick}
            />
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  )
}
