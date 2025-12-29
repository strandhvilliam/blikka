"use client"

import { createContext, use, useContext } from "react"

const DomainProviderContext = createContext<{ domain: string } | null>(null)

// This is used in client components since the useParams hook breifly may be undefined on navigating causing unexpected fetches in with useSuspenseQuery
export function DomainProvider({
  children,
  domain,
}: {
  children: React.ReactNode
  domain: string
}) {
  return (
    <DomainProviderContext.Provider value={{ domain }}>{children}</DomainProviderContext.Provider>
  )
}

export function useDomain(): { domain: string } {
  const context = useContext(DomainProviderContext)
  if (context === null) {
    throw new Error("useDomain must be used within a DomainProvider")
  }
  return context
}
