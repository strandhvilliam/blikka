'use client'

import type { Topic } from '@blikka/db'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PhotoReorderBanner } from '@/components/photos/photo-reorder-banner'
import { canReorderPhotos, sortPhotosByOrderIndex } from '@/lib/flow/photo-ordering'
import { buildPhotoValidationMap, getVisibleGeneralValidationResults } from '@/lib/validation'
import { usePhotoStore } from '@/lib/flow/photo-store'
import { CrossSubmissionValidationCard } from './cross-submission-validation-card'
import { SubmissionItem } from './submission-item'

interface SubmissionListProps {
  topics: Topic[]
  maxPhotos: number
  onUploadClick?: () => void
  onRemovePhoto?: (orderIndex: number) => void
  showCrossSubmissionValidation?: boolean
  isValidationRunning?: boolean
}

export function SubmissionList({
  topics,
  maxPhotos,
  onUploadClick,
  onRemovePhoto,
  showCrossSubmissionValidation = false,
  isValidationRunning = false,
}: SubmissionListProps) {
  const t = useTranslations('FlowPage.uploadStep')
  const photos = usePhotoStore((state) => state.photos)
  const movePhoto = usePhotoStore((state) => state.movePhoto)
  const validationResults = usePhotoStore((state) => state.validationResults)
  const sortedPhotos = useMemo(() => sortPhotosByOrderIndex(photos), [photos])
  const showReorderControls = canReorderPhotos(sortedPhotos)
  const remainingSlots = maxPhotos - photos.length
  const validationMap = useMemo(
    () => buildPhotoValidationMap(photos, validationResults),
    [photos, validationResults],
  )
  const generalValidationResults = useMemo(
    () => getVisibleGeneralValidationResults(validationResults),
    [validationResults],
  )
  const topicsByOrderIndex = useMemo(
    () => new Map(topics.map((topic) => [topic.orderIndex, topic])),
    [topics],
  )

  return (
    <AnimatePresence>
      <div className="flex flex-col gap-2.5">
        {showCrossSubmissionValidation && generalValidationResults.length > 0 ? (
          <CrossSubmissionValidationCard results={generalValidationResults} />
        ) : null}
        {showReorderControls ? <PhotoReorderBanner message={t('reorderPhotosBanner')} /> : null}
        {sortedPhotos.map((photo, index) => (
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
              showPassedValidation={!isValidationRunning}
              index={index}
              onRemove={onRemovePhoto}
              listLength={sortedPhotos.length}
              onMovePhoto={
                showReorderControls ? (direction) => movePhoto(index, direction) : undefined
              }
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
