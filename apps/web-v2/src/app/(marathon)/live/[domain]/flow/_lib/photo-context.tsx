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

interface PhotoContextValue {
  photos: SelectedPhoto[];
  addPhotos: (newPhotos: SelectedPhoto[]) => void;
  removePhoto: (orderIndex: number) => void;
  clearPhotos: () => void;
  reorderPhotos: (photos: SelectedPhoto[]) => void;
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
}

export function PhotoProvider({ children, maxPhotos }: PhotoProviderProps) {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  
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

        return [...current, ...photosToAdd];
      });
    },
    [maxPhotos],
  );

  const removePhoto = useCallback((orderIndex: number) => {
    setPhotos((current) => {
      const photoToRemove = current.find((p) => p.orderIndex === orderIndex);
      
      // Revoke object URL
      if (photoToRemove?.preview) {
        URL.revokeObjectURL(photoToRemove.preview);
        objectUrlsRef.current.delete(photoToRemove.preview);
      }

      // Remove photo and reorder remaining
      const remaining = current.filter((p) => p.orderIndex !== orderIndex);
      return remaining.map((photo, index) => ({
        ...photo,
        orderIndex: index,
      }));
    });
  }, []);

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
  }, []);

  const reorderPhotos = useCallback((reorderedPhotos: SelectedPhoto[]) => {
    setPhotos(reorderedPhotos);
  }, []);

  const value = useMemo(
    () => ({
      photos,
      addPhotos,
      removePhoto,
      clearPhotos,
      reorderPhotos,
    }),
    [photos, addPhotos, removePhoto, clearPhotos, reorderPhotos],
  );

  return (
    <PhotoContext.Provider value={value}>{children}</PhotoContext.Provider>
  );
}
