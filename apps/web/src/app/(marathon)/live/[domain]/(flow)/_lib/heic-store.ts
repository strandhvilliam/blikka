"use client";

import { create } from "zustand";
import { convertHeicToJpeg, isHeicFile } from "@/lib/file-processing";
import { parseExifData } from "@/lib/exif-parsing";

export interface ConvertedFile {
  file: File;
  originalName: string;
  preconvertedExif: Record<string, unknown> | null;
}

export interface HeicConversionState {
  isConverting: boolean;
  isCancelling: boolean;
  progress: { current: number; total: number };
  currentFileName: string | null;
  cancelRequested: boolean;
}

interface HeicConversionResult {
  converted: ConvertedFile[];
  nonHeic: File[];
  cancelled: boolean;
}

interface HeicStore extends HeicConversionState {
  convertFiles: (files: File[]) => Promise<HeicConversionResult>;
  cancel: () => void;
  reset: () => void;
}

const initialState: HeicConversionState = {
  isConverting: false,
  isCancelling: false,
  progress: { current: 0, total: 0 },
  currentFileName: null,
  cancelRequested: false,
};

export const useHeicStore = create<HeicStore>((set, get) => ({
  ...initialState,

  convertFiles: async (files) => {
    const heicFiles = files.filter(isHeicFile);
    const nonHeicFiles = files.filter((f) => !isHeicFile(f));

    if (heicFiles.length === 0) {
      return { converted: [], nonHeic: nonHeicFiles, cancelled: false };
    }

    set({
      isConverting: true,
      isCancelling: false,
      progress: { current: 0, total: heicFiles.length },
      currentFileName: null,
      cancelRequested: false,
    });

    const converted: ConvertedFile[] = [];
    let wasCancelled = false;

    try {
      for (let i = 0; i < heicFiles.length; i++) {
        if (get().cancelRequested) {
          wasCancelled = true;
          break;
        }

        const file = heicFiles[i]!;
        set((state) => ({
          progress: { ...state.progress, current: i },
          currentFileName: file.name,
        }));

        const preconvertedExif = await parseExifData(file);

        if (get().cancelRequested) {
          wasCancelled = true;
          break;
        }

        const convertedFile = await convertHeicToJpeg(file);

        if (get().cancelRequested) {
          wasCancelled = true;
          break;
        }

        if (convertedFile) {
          converted.push({
            file: convertedFile,
            originalName: file.name,
            preconvertedExif,
          });
        }

        set((state) => ({
          progress: { ...state.progress, current: i + 1 },
          currentFileName: null,
        }));
      }
    } finally {
      wasCancelled = wasCancelled || get().cancelRequested;
      set({
        isConverting: false,
        isCancelling: false,
        progress: { current: 0, total: 0 },
        currentFileName: null,
        cancelRequested: false,
      });
    }

    return {
      converted: wasCancelled ? [] : converted,
      nonHeic: nonHeicFiles,
      cancelled: wasCancelled,
    };
  },

  cancel: () => {
    set({ isCancelling: true, cancelRequested: true });
  },

  reset: () => {
    set(initialState);
  },
}));
