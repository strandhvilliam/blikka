"use client";

import { useCallback, useRef, useState } from "react";
import type { HeicConversionState } from "../_lib/types";

interface ConvertedFile {
  file: File;
  originalName: string;
  preconvertedExif: Record<string, unknown> | null;
}

interface UseHeicConversionResult {
  state: HeicConversionState;
  convertFiles: (
    files: File[],
    parseExif: (file: File) => Promise<Record<string, unknown> | null>,
  ) => Promise<{ converted: ConvertedFile[]; nonHeic: File[] }>;
  cancel: () => void;
}

const isHeicFile = (file: File): boolean => {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
};

const convertHeicToJpeg = async (file: File): Promise<File | null> => {
  try {
    const heic2any = await import("heic2any");
    const result = await heic2any.default({
      blob: file,
      toType: "image/jpeg",
      quality: 1,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) return null;

    return new File(
      [blob],
      file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
      { type: "image/jpeg" },
    );
  } catch (error) {
    console.error(`Failed to convert HEIC file ${file.name}:`, error);
    return null;
  }
};

export function useHeicConversion(): UseHeicConversionResult {
  const [state, setState] = useState<HeicConversionState>({
    isConverting: false,
    isCancelling: false,
    progress: { current: 0, total: 0 },
    currentFileName: null,
  });

  const cancelRef = useRef<{ canceled: boolean }>({ canceled: false });

  const cancel = useCallback(() => {
    cancelRef.current.canceled = true;
    setState((prev) => ({ ...prev, isCancelling: true }));
  }, []);

  const convertFiles = useCallback(
    async (
      files: File[],
      parseExif: (file: File) => Promise<Record<string, unknown> | null>,
    ): Promise<{ converted: ConvertedFile[]; nonHeic: File[] }> => {
      const heicFiles = files.filter(isHeicFile);
      const nonHeicFiles = files.filter((f) => !isHeicFile(f));

      if (heicFiles.length === 0) {
        return { converted: [], nonHeic: nonHeicFiles };
      }

      // Reset cancel state
      cancelRef.current.canceled = false;

      setState({
        isConverting: true,
        isCancelling: false,
        progress: { current: 0, total: heicFiles.length },
        currentFileName: null,
      });

      const converted: ConvertedFile[] = [];

      try {
        for (let i = 0; i < heicFiles.length; i++) {
          // Check for cancellation
          if (cancelRef.current.canceled) {
            break;
          }

          const file = heicFiles[i]!;
          setState((prev) => ({
            ...prev,
            currentFileName: file.name,
            progress: { ...prev.progress, current: i },
          }));

          // Parse EXIF before conversion (HEIC files lose EXIF during conversion)
          const preconvertedExif = await parseExif(file);

          // Check for cancellation again after async operation
          if (cancelRef.current.canceled) {
            break;
          }

          const convertedFile = await convertHeicToJpeg(file);

          if (cancelRef.current.canceled) {
            break;
          }

          if (convertedFile) {
            converted.push({
              file: convertedFile,
              originalName: file.name,
              preconvertedExif,
            });
          }

          setState((prev) => ({
            ...prev,
            progress: { ...prev.progress, current: i + 1 },
          }));
        }
      } finally {
        setState({
          isConverting: false,
          isCancelling: false,
          progress: { current: 0, total: 0 },
          currentFileName: null,
        });
      }

      return {
        converted: cancelRef.current.canceled ? [] : converted,
        nonHeic: nonHeicFiles,
      };
    },
    [],
  );

  return {
    state,
    convertFiles,
    cancel,
  };
}
