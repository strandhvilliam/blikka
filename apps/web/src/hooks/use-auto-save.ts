"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseAutoSaveOptions<T> {
  /** The current value to watch for changes */
  value: T;
  /** Callback to save the value */
  onSave: (value: T) => void;
  /** Debounce delay in milliseconds (default: 500) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook that automatically saves values after a debounce delay when they change.
 * Compares values using JSON serialization to detect actual changes.
 */
export function useAutoSave<T>({
  value,
  onSave,
  delay = 500,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef<string>("");
  const onSaveRef = useRef(onSave);

  // Keep onSave ref up to date without triggering effect
  onSaveRef.current = onSave;

  const cancelPendingSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset state when value is externally updated (e.g., server sync)
  const resetToValue = useCallback(
    (newValue: T) => {
      cancelPendingSave();
      previousValueRef.current = JSON.stringify(newValue);
    },
    [cancelPendingSave],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const currentValueStr = JSON.stringify(value);

    // Skip if value hasn't actually changed
    if (currentValueStr === previousValueRef.current) {
      return;
    }

    previousValueRef.current = currentValueStr;

    // Clear existing timeout
    cancelPendingSave();

    // Schedule save after delay
    timeoutRef.current = setTimeout(() => {
      onSaveRef.current(value);
    }, delay);

    return cancelPendingSave;
  }, [value, delay, enabled, cancelPendingSave]);

  // Cleanup on unmount
  useEffect(() => {
    return cancelPendingSave;
  }, [cancelPendingSave]);

  return {
    cancelPendingSave,
    resetToValue,
  };
}
