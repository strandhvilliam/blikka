"use client"

import { useCallback, useEffect, useRef } from "react"
import type { QueryClient, QueryKey } from "@tanstack/react-query"

export function useDebouncedInvalidate(
  queryClient: QueryClient,
  queryKey: QueryKey,
  delayMs: number,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey })
    }, delayMs)
  }, [queryClient, queryKey, delayMs])
}
