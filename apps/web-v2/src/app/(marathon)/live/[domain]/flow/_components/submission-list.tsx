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
  const { photos } = usePhotoContext();
  const remainingSlots = maxPhotos - photos.length;

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.file.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            layout
          >
            <SubmissionItem
              photo={photo}
              topic={topics[index]}
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
              delay: (photos.length + index) * 0.05,
            }}
            layout
          >
            <SubmissionItem
              topic={topics[photos.length + index]}
              index={photos.length + index}
              onUploadClick={onUploadClick}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
