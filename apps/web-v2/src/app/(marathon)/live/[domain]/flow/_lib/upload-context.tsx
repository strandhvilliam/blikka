"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  FileUploadError,
  PhotoWithPresignedUrl,
  UploadFileState,
  UploadPhase,
} from "./types";
import { UPLOAD_PHASE } from "./types";

interface UploadContextValue {
  files: Map<string, UploadFileState>;
  isUploading: boolean;

  // Actions
  initializeFiles: (photos: PhotoWithPresignedUrl[]) => void;
  updateFilePhase: (key: string, phase: UploadPhase, progress?: number) => void;
  setFileError: (key: string, error: FileUploadError) => void;
  setFileProgress: (key: string, progress: number) => void;
  clearFiles: () => void;
  setIsUploading: (uploading: boolean) => void;

  // File locking (prevents race conditions)
  lockFile: (key: string) => void;
  unlockFile: (key: string) => void;
  isFileLocked: (key: string) => boolean;

  // Selectors
  getFile: (key: string) => UploadFileState | undefined;
  getFailedFiles: () => UploadFileState[];
  getAllFiles: () => UploadFileState[];
  getCompletedCount: () => number;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploadContext must be used within an UploadProvider");
  }
  return context;
}

interface UploadProviderProps {
  children: React.ReactNode;
}

export function UploadProvider({ children }: UploadProviderProps) {
  const [files, setFiles] = useState<Map<string, UploadFileState>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  // File locking stored in ref to persist across renders (fixed from original bug)
  const lockedFilesRef = useRef<Set<string>>(new Set());

  const initializeFiles = useCallback((photos: PhotoWithPresignedUrl[]) => {
    const fileMap = new Map<string, UploadFileState>();

    photos.forEach((photo) => {
      fileMap.set(photo.key, {
        key: photo.key,
        orderIndex: photo.orderIndex,
        file: photo.file,
        presignedUrl: photo.presignedUrl,
        preview: photo.preview,
        phase: UPLOAD_PHASE.PRESIGNED,
        progress: 0,
        startedAt: new Date(),
      });
    });

    setFiles(fileMap);
    setIsUploading(true);
  }, []);

  const updateFilePhase = useCallback(
    (key: string, phase: UploadPhase, progress?: number) => {
      setFiles((current) => {
        const newFiles = new Map(current);
        const file = newFiles.get(key);

        if (file) {
          const updatedFile: UploadFileState = {
            ...file,
            phase,
            progress: progress ?? file.progress,
            error: phase === UPLOAD_PHASE.ERROR ? file.error : undefined,
          };

          // Set timestamps based on phase
          if (phase === UPLOAD_PHASE.UPLOADING && !file.startedAt) {
            updatedFile.startedAt = new Date();
          } else if (phase === UPLOAD_PHASE.COMPLETED && !file.completedAt) {
            updatedFile.completedAt = new Date();
            updatedFile.progress = 100;
          }

          newFiles.set(key, updatedFile);
        }

        return newFiles;
      });
    },
    [],
  );

  const setFileError = useCallback((key: string, error: FileUploadError) => {
    setFiles((current) => {
      const newFiles = new Map(current);
      const file = newFiles.get(key);

      if (file) {
        newFiles.set(key, {
          ...file,
          phase: UPLOAD_PHASE.ERROR,
          error,
        });
      }

      return newFiles;
    });
  }, []);

  const setFileProgress = useCallback((key: string, progress: number) => {
    setFiles((current) => {
      const newFiles = new Map(current);
      const file = newFiles.get(key);

      if (file && file.phase === UPLOAD_PHASE.UPLOADING) {
        newFiles.set(key, {
          ...file,
          progress: Math.min(100, Math.max(0, progress)),
        });
      }

      return newFiles;
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles(new Map());
    setIsUploading(false);
    lockedFilesRef.current.clear();
  }, []);

  // File locking methods
  const lockFile = useCallback((key: string) => {
    lockedFilesRef.current.add(key);
  }, []);

  const unlockFile = useCallback((key: string) => {
    lockedFilesRef.current.delete(key);
  }, []);

  const isFileLocked = useCallback((key: string) => {
    return lockedFilesRef.current.has(key);
  }, []);

  // Selectors
  const getFile = useCallback(
    (key: string) => {
      return files.get(key);
    },
    [files],
  );

  const getFailedFiles = useCallback(() => {
    return Array.from(files.values()).filter(
      (file) => file.phase === UPLOAD_PHASE.ERROR,
    );
  }, [files]);

  const getAllFiles = useCallback(() => {
    return Array.from(files.values());
  }, [files]);

  const getCompletedCount = useCallback(() => {
    return Array.from(files.values()).filter(
      (file) =>
        file.phase === UPLOAD_PHASE.COMPLETED ||
        file.phase === UPLOAD_PHASE.PROCESSING,
    ).length;
  }, [files]);

  const value = useMemo(
    () => ({
      files,
      isUploading,
      initializeFiles,
      updateFilePhase,
      setFileError,
      setFileProgress,
      clearFiles,
      setIsUploading,
      lockFile,
      unlockFile,
      isFileLocked,
      getFile,
      getFailedFiles,
      getAllFiles,
      getCompletedCount,
    }),
    [
      files,
      isUploading,
      initializeFiles,
      updateFilePhase,
      setFileError,
      setFileProgress,
      clearFiles,
      lockFile,
      unlockFile,
      isFileLocked,
      getFile,
      getFailedFiles,
      getAllFiles,
      getCompletedCount,
    ],
  );

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
}
