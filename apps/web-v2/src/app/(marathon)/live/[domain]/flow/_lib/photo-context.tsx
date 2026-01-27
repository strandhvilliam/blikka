"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SelectedPhoto } from "./types";
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

interface PhotoContextValue {
  photos: SelectedPhoto[];
  validationResults: ValidationResult[];
  addPhotos: (newPhotos: SelectedPhoto[]) => void;
  removePhoto: (orderIndex: number) => void;
  clearPhotos: () => void;
  reorderPhotos: (photos: SelectedPhoto[]) => void;
  runPhotoValidation: () => void;
}

const PhotoContext = createContext<PhotoContextValue | null>(null);

export function usePhotoContext() {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error("usePhotoContext must be used within a PhotoProvider");
  }
  return context;
}

interface PhotoProviderProps {
  children: React.ReactNode;
  maxPhotos: number;
  validationRules: ValidationRule[];
  marathonStartDate?: string | Date;
  marathonEndDate?: string | Date;
  topicOrderIndexes: number[];
}

export function PhotoProvider({
  children,
  maxPhotos,
  validationRules,
  marathonStartDate,
  marathonEndDate,
  topicOrderIndexes,
}: PhotoProviderProps) {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

  // Track object URLs for cleanup
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      urls.clear();
    };
  }, []);

  // Prepare validation rules with marathon dates for time range validation
  const preparedValidationRules = useMemo(() => {
    return validationRules.map((rule) => {
      if (rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE && marathonStartDate && marathonEndDate) {
        return {
          ...rule,
          params: {
            ...rule.params,
            [RULE_KEYS.WITHIN_TIMERANGE]: {
              start: marathonStartDate,
              end: marathonEndDate,
            },
          },
        };
      }
      return rule;
    });
  }, [validationRules, marathonStartDate, marathonEndDate]);

  // Run validation on photos using Effect
  const runPhotoValidation = useCallback(
    async (photosToValidate: SelectedPhoto[]) => {
      if (photosToValidate.length === 0) {
        setValidationResults([]);
        return;
      }

      const validationInputs: ValidationInput[] = photosToValidate.map((photo) => ({
        exif: photo.exif,
        fileName: photo.file.name,
        fileSize: photo.file.size,
        orderIndex: photo.orderIndex,
        mimeType: photo.file.type,
      }));

      // Create the validation effect program
      const program = Effect.gen(function* () {
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
        setValidationResults(results);
      } catch (error) {
        console.error("Validation error:", error);
        setValidationResults([]);
      }
    },
    [preparedValidationRules]
  );

  // Helper to get EXIF date for sorting
  const getExifDate = (exif: Record<string, unknown>): Date | null => {
    if (!exif) return null;
    const dateValue = exif.DateTimeOriginal || exif.CreateDate;
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue as string);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  // Run validation whenever photos change
  useEffect(() => {
    runPhotoValidation(photos);
  }, [photos, runPhotoValidation]);

  const addPhotos = useCallback(
    (newPhotos: SelectedPhoto[]) => {
      setPhotos((current) => {
        const remainingSlots = maxPhotos - current.length;
        const photosToAdd = newPhotos.slice(0, remainingSlots);

        // Track new object URLs
        photosToAdd.forEach((photo) => {
          if (photo.preview) {
            objectUrlsRef.current.add(photo.preview);
          }
        });

        // Combine and sort by EXIF time
        const allPhotos = [...current, ...photosToAdd];
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
            orderIndex: topicOrderIndexes[index] ?? index,
          }));

        return sortedPhotos;
      });
    },
    [maxPhotos, topicOrderIndexes],
  );

  const removePhoto = useCallback(
    (orderIndex: number) => {
      setPhotos((current) => {
        const photoToRemove = current.find((p) => p.orderIndex === orderIndex);

        // Revoke object URL
        if (photoToRemove?.preview) {
          URL.revokeObjectURL(photoToRemove.preview);
          objectUrlsRef.current.delete(photoToRemove.preview);
        }

        // Remove photo and reorder remaining
        const remaining = current.filter((p) => p.orderIndex !== orderIndex);
        const reorderedPhotos = remaining.map((photo, index) => ({
          ...photo,
          orderIndex: topicOrderIndexes[index] ?? index,
        }));

        return reorderedPhotos;
      });
    },
    [topicOrderIndexes]
  );

  const clearPhotos = useCallback(() => {
    setPhotos((current) => {
      // Revoke all object URLs
      current.forEach((photo) => {
        if (photo.preview) {
          URL.revokeObjectURL(photo.preview);
          objectUrlsRef.current.delete(photo.preview);
        }
      });
      return [];
    });
    setValidationResults([]);
  }, []);

  const reorderPhotos = useCallback((reorderedPhotos: SelectedPhoto[]) => {
    setPhotos(reorderedPhotos);
  }, []);

  // Expose manual validation trigger
  const triggerValidation = useCallback(() => {
    runPhotoValidation(photos);
  }, [photos, runPhotoValidation]);

  const value = useMemo(
    () => ({
      photos,
      validationResults,
      addPhotos,
      removePhoto,
      clearPhotos,
      reorderPhotos,
      runPhotoValidation: triggerValidation,
    }),
    [photos, validationResults, addPhotos, removePhoto, clearPhotos, reorderPhotos, triggerValidation],
  );

  return (
    <PhotoContext.Provider value={value}>{children}</PhotoContext.Provider>
  );
}
