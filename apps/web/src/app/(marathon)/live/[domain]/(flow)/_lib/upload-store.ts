"use client";

import { create } from "zustand";
import type {
  FileUploadError,
  PhotoWithPresignedUrl,
  UploadFileState,
  UploadPhase,
} from "./types";
import { UPLOAD_PHASE } from "./types";

interface UploadStore {
  // State
  files: Map<string, UploadFileState>;
  isUploading: boolean;
  lockedFiles: Set<string>;

  // Actions
  initializeFiles: (photos: PhotoWithPresignedUrl[]) => void;
  updateFilePhase: (key: string, phase: UploadPhase, progress?: number) => void;
  setFileProcessingComplete: (key: string) => void;
  setFileError: (key: string, error: FileUploadError) => void;
  setFileProgress: (key: string, progress: number) => void;
  clearFiles: () => void;
  setIsUploading: (uploading: boolean) => void;

  // File locking
  lockFile: (key: string) => void;
  unlockFile: (key: string) => void;
  isFileLocked: (key: string) => boolean;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  files: new Map(),
  isUploading: false,
  lockedFiles: new Set(),

  initializeFiles: (photos) => {
    const fileMap = new Map<string, UploadFileState>();

    photos.forEach((photo) => {
      fileMap.set(photo.key, {
        key: photo.key,
        orderIndex: photo.orderIndex,
        file: photo.file,
        presignedUrl: photo.presignedUrl,
        preview: photo.preview,
        contentType: photo.contentType,
        phase: UPLOAD_PHASE.PRESIGNED,
        progress: 0,
        isProcessingComplete: false,
        startedAt: new Date(),
      });
    });

    set({ files: fileMap, isUploading: true });
  },

  updateFilePhase: (key, phase, progress) => {
    const state = get();
    const file = state.files.get(key);

    if (file) {
      const newFiles = new Map(state.files);
      const updatedFile: UploadFileState = {
        ...file,
        phase,
        progress: progress ?? file.progress,
        isProcessingComplete:
          phase === UPLOAD_PHASE.UPLOADED ? file.isProcessingComplete : false,
        error: phase === UPLOAD_PHASE.ERROR ? file.error : undefined,
      };

      if (phase === UPLOAD_PHASE.UPLOADING && !file.startedAt) {
        updatedFile.startedAt = new Date();
      } else if (phase === UPLOAD_PHASE.UPLOADED && !file.completedAt) {
        updatedFile.completedAt = new Date();
        updatedFile.progress = 100;
      }

      newFiles.set(key, updatedFile);
      set({ files: newFiles });
    }
  },

  setFileProcessingComplete: (key) => {
    const state = get();
    const file = state.files.get(key);

    if (file && file.phase === UPLOAD_PHASE.UPLOADED && !file.isProcessingComplete) {
      const newFiles = new Map(state.files);
      newFiles.set(key, {
        ...file,
        isProcessingComplete: true,
      });
      set({ files: newFiles });
    }
  },

  setFileError: (key, error) => {
    const state = get();
    const file = state.files.get(key);

    if (file) {
      const newFiles = new Map(state.files);
      newFiles.set(key, {
        ...file,
        phase: UPLOAD_PHASE.ERROR,
        error,
      });
      set({ files: newFiles });
    }
  },

  setFileProgress: (key, progress) => {
    const state = get();
    const file = state.files.get(key);

    if (file && file.phase === UPLOAD_PHASE.UPLOADING) {
      const newFiles = new Map(state.files);
      newFiles.set(key, {
        ...file,
        progress: Math.min(100, Math.max(0, progress)),
      });
      set({ files: newFiles });
    }
  },

  clearFiles: () => {
    set({
      files: new Map(),
      isUploading: false,
      lockedFiles: new Set(),
    });
  },

  setIsUploading: (uploading) => {
    set({ isUploading: uploading });
  },

  lockFile: (key) => {
    const state = get();
    const newLockedFiles = new Set(state.lockedFiles);
    newLockedFiles.add(key);
    set({ lockedFiles: newLockedFiles });
  },

  unlockFile: (key) => {
    const state = get();
    const newLockedFiles = new Set(state.lockedFiles);
    newLockedFiles.delete(key);
    set({ lockedFiles: newLockedFiles });
  },

  isFileLocked: (key) => {
    return get().lockedFiles.has(key);
  },
}));

export const selectFile = (state: ReturnType<typeof useUploadStore.getState>, key: string) =>
  state.files.get(key);

export const selectFailedFiles = (state: ReturnType<typeof useUploadStore.getState>) =>
  Array.from(state.files.values()).filter((file) => file.phase === UPLOAD_PHASE.ERROR);

export const selectAllFiles = (state: ReturnType<typeof useUploadStore.getState>) =>
  Array.from(state.files.values());

export const selectCompletedCount = (state: ReturnType<typeof useUploadStore.getState>) =>
  Array.from(state.files.values()).filter(
    (file) => file.phase === UPLOAD_PHASE.UPLOADED,
  ).length;
