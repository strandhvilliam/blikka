'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type JuryReviewViewerActions = {
  assignToRank: (rank: 1 | 2 | 3) => void
}

type JuryReviewInteractionContextValue = {
  viewerActions: JuryReviewViewerActions | null
  registerViewerActions: (actions: JuryReviewViewerActions | null) => void
}

const JuryReviewInteractionContext = createContext<JuryReviewInteractionContextValue | null>(null)

export function JuryReviewInteractionProvider({ children }: { children: ReactNode }) {
  const [viewerActions, setViewerActions] = useState<JuryReviewViewerActions | null>(null)

  const registerViewerActions = useCallback((actions: JuryReviewViewerActions | null) => {
    setViewerActions(actions)
  }, [])

  const value = useMemo(
    () => ({
      viewerActions,
      registerViewerActions,
    }),
    [registerViewerActions, viewerActions],
  )

  return (
    <JuryReviewInteractionContext.Provider value={value}>
      {children}
    </JuryReviewInteractionContext.Provider>
  )
}

export function useJuryReviewInteraction() {
  const ctx = useContext(JuryReviewInteractionContext)
  if (!ctx) {
    throw new Error('useJuryReviewInteraction must be used within JuryReviewInteractionProvider')
  }
  return ctx
}
