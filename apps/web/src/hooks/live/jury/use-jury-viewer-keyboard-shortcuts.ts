'use client'

import { useEffect } from 'react'
import { isShortcutBlockedTarget } from '@/lib/keyboard-shortcuts'

type Params = {
  /** Fullscreen owns navigation, Escape and zoom; the review keys stay live in both modes. */
  isFullscreenOpen: boolean
  canOpenFullscreen: boolean
  localRating: number
  goToPrev: () => void
  goToNext: () => void
  onBack: () => void
  onRatingClick: (star: number) => void
  onToggleShortlist: () => void
  onWinnerClick: () => void
  onToggleFullscreen: () => void
}

export function useJuryViewerKeyboardShortcuts({
  isFullscreenOpen,
  canOpenFullscreen,
  localRating,
  goToPrev,
  goToNext,
  onBack,
  onRatingClick,
  onToggleShortlist,
  onWinnerClick,
  onToggleFullscreen,
}: Params) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isShortcutBlockedTarget(event.target)) return

      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key) {
        // Fullscreen binds the arrows itself, so it can reset the zoom as the photo changes.
        case 'ArrowLeft':
          if (isFullscreenOpen) return
          event.preventDefault()
          goToPrev()
          break
        case 'ArrowRight':
          if (isFullscreenOpen) return
          event.preventDefault()
          goToNext()
          break
        // In fullscreen Escape means "leave fullscreen", which the browser and the viewer handle.
        case 'Escape':
          if (isFullscreenOpen) return
          event.preventDefault()
          onBack()
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          event.preventDefault()
          onRatingClick(Number(event.key))
          break
        case ']':
          event.preventDefault()
          onRatingClick(Math.min(5, localRating + 1))
          break
        case '[':
          event.preventDefault()
          onRatingClick(Math.max(0, localRating - 1))
          break
        case 's':
        case 'S':
          event.preventDefault()
          onToggleShortlist()
          break
        case 'w':
        case 'W':
          event.preventDefault()
          onWinnerClick()
          break
        case 'f':
        case 'F':
          if (!isFullscreenOpen && !canOpenFullscreen) return
          event.preventDefault()
          onToggleFullscreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    canOpenFullscreen,
    goToPrev,
    goToNext,
    onRatingClick,
    onBack,
    onToggleShortlist,
    onWinnerClick,
    onToggleFullscreen,
    localRating,
    isFullscreenOpen,
  ])
}
