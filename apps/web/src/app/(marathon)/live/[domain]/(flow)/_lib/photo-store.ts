"use client";

import { create } from "zustand";
import { Effect } from "effect";
import { type ValidationResult, type ValidationRule } from "@blikka/validation";
import type { SelectedPhoto } from "./types";
import {
  buildValidationInputs,
  prepareValidationRules,
  runClientValidation,
} from "@/lib/validation";
import {
  reassignOrderIndexes,
  revokePreviewUrls,
  sortByExifDate,
} from "@/lib/file-processing";

interface PhotoStore {
  // State
  photos: SelectedPhoto[];
  validationResults: ValidationResult[];
  maxPhotos: number;
  validationRules: ValidationRule[];
  marathonStartDate?: string | Date;
  marathonEndDate?: string | Date;
  topicOrderIndexes: number[];
  objectUrls: Set<string>;

  // Actions
  initialize: (config: {
    maxPhotos: number;
    validationRules: ValidationRule[];
    marathonStartDate?: string | Date;
    marathonEndDate?: string | Date;
    topicOrderIndexes: number[];
  }) => void;
  addPhotos: (newPhotos: SelectedPhoto[]) => void;
  removePhoto: (orderIndex: number) => void;
  clearPhotos: () => void;
  reorderPhotos: (photos: SelectedPhoto[]) => void;
  runPhotoValidation: () => Promise<void>;
  cleanup: () => void;
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  validationResults: [],
  maxPhotos: 0,
  validationRules: [],
  topicOrderIndexes: [],
  objectUrls: new Set<string>(),

  initialize: (config) => {
    set({
      maxPhotos: config.maxPhotos,
      validationRules: config.validationRules,
      marathonStartDate: config.marathonStartDate,
      marathonEndDate: config.marathonEndDate,
      topicOrderIndexes: config.topicOrderIndexes,
    });
  },

  addPhotos: (newPhotos) => {
    const state = get();
    const remainingSlots = state.maxPhotos - state.photos.length;
    const photosToAdd = newPhotos.slice(0, remainingSlots);

    const newObjectUrls = new Set(state.objectUrls);
    photosToAdd.forEach((photo) => {
      if (photo.preview) {
        newObjectUrls.add(photo.preview);
      }
    });

    const sortedPhotos = reassignOrderIndexes(
      sortByExifDate([...state.photos, ...photosToAdd], (photo) => photo.exif),
      state.topicOrderIndexes,
      (photo, orderIndex) => ({
        ...photo,
        orderIndex,
      }),
    );

    set({ photos: sortedPhotos, objectUrls: newObjectUrls });

    get().runPhotoValidation();
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

      get().runPhotoValidation();
    }
  },

  clearPhotos: () => {
    const state = get();

    revokePreviewUrls(state.photos, (photo) => photo.preview);

    set({ photos: [], validationResults: [], objectUrls: new Set() });
  },

  reorderPhotos: (reorderedPhotos) => {
    set({ photos: reorderedPhotos });
    get().runPhotoValidation();
  },

  runPhotoValidation: async () => {
    const state = get();

    if (state.photos.length === 0) {
      set({ validationResults: [] });
      return;
    }

    const preparedValidationRules = prepareValidationRules(
      state.validationRules,
      {
        start: state.marathonStartDate,
        end: state.marathonEndDate,
      },
    );

    try {
      const results = await runClientValidation(
        preparedValidationRules,
        buildValidationInputs(state.photos),
      );
      set({ validationResults: results });
    } catch (error) {
      console.error("Validation error:", error);
      set({ validationResults: [] });
    }
  },

  cleanup: () => {
    const state = get();
    revokePreviewUrls(Array.from(state.objectUrls), (url) => url);
    set({ objectUrls: new Set() });
  },
}));
