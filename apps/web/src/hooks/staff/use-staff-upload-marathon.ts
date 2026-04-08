"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"

export function useStaffUploadMarathon() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  return data
}
