"use client"

import { createContext, useContext } from "react"

const JuryClientTokenContext = createContext<string | null>(null)

export function JuryClientTokenProvider({
  children,
  token,
}: {
  children: React.ReactNode
  token: string
}) {
  return (
    <JuryClientTokenContext.Provider value={token}>
      {children}
    </JuryClientTokenContext.Provider>
  )
}

export function useJuryClientToken(): string {
  const context = useContext(JuryClientTokenContext)
  if (context === null) {
    throw new Error(
      "useJuryClientToken must be used within a JuryClientTokenProvider",
    )
  }
  return context
}
