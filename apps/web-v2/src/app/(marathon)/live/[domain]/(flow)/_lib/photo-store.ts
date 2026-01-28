"use client";

import { create } from "zustand";
import { Effect } from "effect";
import {
  ValidationEngine,
  SingleValidationsService,
  GroupedValidationsService,
  RULE_KEYS,
  type ValidationResult,
  type ValidationRule,
  type ValidationInput,
} from "@blikka/validation";
import type { SelectedPhoto } from "./types";
import { getExifDate, prepareValidationRules } from "./utils";


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

    const allPhotos = [...state.photos, ...photosToAdd];
    const sortedPhotos = allPhotos
      .sort((a, b) => {
        const aDate = getExifDate(a.exif);
        const bDate = getExifDate(b.exif);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.getTime() - bDate.getTime();
      })
      .map((photo, index) => ({
        ...photo,
        orderIndex: state.topicOrderIndexes[index] ?? index,
      }));

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
      const reorderedPhotos = remaining.map((photo, index) => ({
        ...photo,
        orderIndex: state.topicOrderIndexes[index] ?? index,
      }));

      set({ photos: reorderedPhotos, objectUrls: newObjectUrls });

      get().runPhotoValidation();
    }
  },

  clearPhotos: () => {
    const state = get();

    state.photos.forEach((photo) => {
      if (photo.preview) {
        URL.revokeObjectURL(photo.preview);
      }
    });

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

    const preparedValidationRules = prepareValidationRules(state.validationRules, { start: state.marathonStartDate, end: state.marathonEndDate });

    const validationInputs: ValidationInput[] = state.photos.map((photo) => ({
      exif: photo.exif,
      fileName: photo.file.name,
      fileSize: photo.file.size,
      orderIndex: photo.orderIndex,
      mimeType: photo.file.type,
    }));

    const program = Effect.gen(function*() {
      const engine = yield* ValidationEngine;
      return yield* engine.runValidations(preparedValidationRules, validationInputs);
    });

    // Provide the required services and run the effect
    const runnable = program.pipe(
      Effect.provide(ValidationEngine.Default),
      Effect.provide(SingleValidationsService.Default),
      Effect.provide(GroupedValidationsService.Default),
    );

    try {
      const results = await Effect.runPromise(runnable);
      set({ validationResults: results });
    } catch (error) {
      console.error("Validation error:", error);
      set({ validationResults: [] });
    }
  },

  // Cleanup on unmount
  cleanup: () => {
    const state = get();
    state.objectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    set({ objectUrls: new Set() });
  },
}));
