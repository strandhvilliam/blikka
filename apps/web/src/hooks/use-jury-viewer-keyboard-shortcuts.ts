import { useEffect } from "react"

type Params = {
  isFullscreenOpen: boolean
  localRating: number
  goToPrev: () => void
  goToNext: () => void
  onBack: () => void
  onRatingClick: (star: number) => void
}

export function useJuryViewerKeyboardShortcuts({
  isFullscreenOpen,
  localRating,
  goToPrev,
  goToNext,
  onBack,
  onRatingClick,
}: Params) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFullscreenOpen) return

      if (
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLInputElement
      ) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault()
          goToPrev()
          break
        case "ArrowRight":
          event.preventDefault()
          goToNext()
          break
        case "Escape":
          event.preventDefault()
          onBack()
          break
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          event.preventDefault()
          onRatingClick(Number(event.key))
          break
        case "]":
          event.preventDefault()
          onRatingClick(Math.min(5, localRating + 1))
          break
        case "[":
          event.preventDefault()
          onRatingClick(Math.max(0, localRating - 1))
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    goToPrev,
    goToNext,
    onRatingClick,
    onBack,
    localRating,
    isFullscreenOpen,
  ])
}
