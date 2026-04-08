"use client";

import { create } from "zustand";
import { type ValidationResult } from "@blikka/validation";
import type { SelectedPhoto } from "./types";
import {
  reassignOrderIndexes,
  revokePreviewUrls,
} from "@/lib/file-processing";

interface PhotoStore {
  photos: SelectedPhoto[];
  validationResults: ValidationResult[];
  topicOrderIndexes: number[];
  objectUrls: Set<string>;
  isProcessingFiles: boolean;

  initialize: (config: {
    topicOrderIndexes: number[];
  }) => void;
  setPhotos: (photos: SelectedPhoto[]) => void;
  removePhoto: (orderIndex: number) => void;
  clearPhotos: () => void;
  reorderPhotos: (photos: SelectedPhoto[]) => void;
  setValidationResults: (results: ValidationResult[]) => void;
  setIsProcessingFiles: (isProcessing: boolean) => void;
  cleanup: () => void;
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  validationResults: [],
  topicOrderIndexes: [],
  objectUrls: new Set<string>(),
  isProcessingFiles: false,

  initialize: (config) => {
    const state = get();
    const nextTopicOrderIndexes = config.topicOrderIndexes;
    set({
      topicOrderIndexes: nextTopicOrderIndexes,
      photos:
        state.photos.length === 0
          ? state.photos
          : reassignOrderIndexes(
              state.photos,
              nextTopicOrderIndexes,
              (photo, orderIndex) => ({
                ...photo,
                orderIndex,
              }),
            ),
    });
  },

  setPhotos: (photos) => {
    const state = get();
    const nextUrls = new Set(
      photos.map((photo) => photo.preview).filter(Boolean),
    );

    state.photos.forEach((photo) => {
      if (!nextUrls.has(photo.preview)) {
        URL.revokeObjectURL(photo.preview);
      }
    });

    set({ photos, objectUrls: nextUrls });
  },

  removePhoto: (orderIndex) => {
    const state = get();
    const photoToRemove = state.photos.find((p) => p.orderIndex === orderIndex);

    if (photoToRemove?.preview) {
      URL.revokeObjectURL(photoToRemove.preview);
      const newObjectUrls = new Set(state.objectUrls);
      newObjectUrls.delete(photoToRemove.preview);

      const remaining = state.photos.filter((p) => p.orderIndex !== orderIndex);
      const reorderedPhotos = reassignOrderIndexes(
        remaining,
        state.topicOrderIndexes,
        (photo, nextOrderIndex) => ({
          ...photo,
          orderIndex: nextOrderIndex,
        }),
      );

      set({ photos: reorderedPhotos, objectUrls: newObjectUrls });
    }
  },

  clearPhotos: () => {
    const state = get();

    revokePreviewUrls(state.photos, (photo) => photo.preview);

    set({
      photos: [],
      validationResults: [],
      objectUrls: new Set(),
      isProcessingFiles: false,
    });
  },

  reorderPhotos: (reorderedPhotos) => {
    set({ photos: reorderedPhotos });
  },

  setValidationResults: (results) => set({ validationResults: results }),

  setIsProcessingFiles: (isProcessing) => set({ isProcessingFiles: isProcessing }),

  cleanup: () => {
    const state = get();
    revokePreviewUrls(Array.from(state.objectUrls), (url) => url);
    set({ objectUrls: new Set(), isProcessingFiles: false });
  },
}));
