"use client";

import type { Topic } from "@blikka/db";
import { AnimatePresence, motion } from "motion/react";
import { usePhotoContext } from "../_lib/photo-context";
import { SubmissionItem } from "./submission-item";

interface SubmissionListProps {
  topics: Topic[];
  maxPhotos: number;
  onUploadClick?: () => void;
  onRemovePhoto?: (orderIndex: number) => void;
}

export function SubmissionList({
  topics,
  maxPhotos,
  onUploadClick,
  onRemovePhoto,
}: SubmissionListProps) {
  const { photos, validationResults } = usePhotoContext();
  const remainingSlots = maxPhotos - photos.length;

  return (
    <AnimatePresence>
      <div className="flex flex-col space-y-2">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.file.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.1 }}
          >
            <SubmissionItem
              photo={photo}
              topic={topics[index]}
              validationResults={validationResults.filter(
                (result) => result.fileName === photo.file.name,
              )}
              index={index}
              onRemove={onRemovePhoto}
            />
          </motion.div>
        ))}
        {Array.from({ length: remainingSlots }).map((_, index) => (
          <motion.div
            key={`empty-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: (photos.length + index) * 0.1,
            }}
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
  );
}
