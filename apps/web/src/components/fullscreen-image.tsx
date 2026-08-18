'use client'

import type { MouseEvent, PointerEvent, ReactNode, TouchEvent, WheelEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { isShortcutBlockedTarget } from '@/lib/keyboard-shortcuts'
import {
  SubmissionOptimizedOriginalImage,
  SubmissionRawOriginalImage,
  SubmissionThumbnailImage,
} from '@/components/submission-image'

export type FullscreenImageProps = {
  src: string
  alt: string
  sourceKind?: 'original' | 'thumbnail' | 'raw'
  isOpen: boolean
  onClose: () => void
  /** Rendered in the top bar, left of the zoom controls — what is on screen. */
  label?: ReactNode
  /** Rendered along the bottom edge. Replaces the default zoom/pan hint. */
  overlay?: ReactNode
  /** Supplying either handler adds edge chevrons and binds the arrow keys. */
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  /**
   * Receives the fullscreened element while open, and `null` once closed. Nothing outside that
   * subtree paints while the browser is in native fullscreen, so callers portal their dialogs
   * into it rather than into `document.body`.
   */
  onContainerChange?: (element: HTMLElement | null) => void
}

const isFullscreenSupported =
  typeof document !== 'undefined' && 'fullscreenEnabled' in document && document.fullscreenEnabled

/** Long enough that the controls do not blink away mid-glance, short enough to leave the photo alone. */
const CHROME_IDLE_MS = 2600

/**
 * The fullscreened element stays mounted for as long as the viewer is open — remounting it would
 * drop the browser out of fullscreen. Everything that belongs to *one photo* lives in the stage
 * below, keyed by `src`, so paging to the next submission starts it unzoomed, unpanned, and with
 * the controls back on screen without a single reset effect.
 */
export function FullscreenImage({
  src,
  alt,
  sourceKind = 'original',
  isOpen,
  onClose,
  label,
  overlay,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onContainerChange,
}: FullscreenImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !isFullscreenSupported) return

    if (isOpen) {
      containerRef.current.requestFullscreen?.().catch(() => {
        // Fallback: still show the modal even if fullscreen fails
      })
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {
        // Ignore errors
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (!onContainerChange) return

    onContainerChange(isOpen ? containerRef.current : null)
    return () => onContainerChange(null)
  }, [isOpen, onContainerChange])

  useEffect(() => {
    if (!isFullscreenSupported) return

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isOpen) {
        onClose()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalWidth = document.body.style.width
    const originalHeight = document.body.style.height
    const originalTouchAction = document.body.style.touchAction

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.height = '100%'
    document.body.style.touchAction = 'none'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.width = originalWidth
      document.body.style.height = originalHeight
      document.body.style.touchAction = originalTouchAction
    }
  }, [isOpen])

  if (!isOpen || !src) return null

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black">
      <FullscreenStage
        key={src}
        src={src}
        alt={alt}
        sourceKind={sourceKind}
        onClose={onClose}
        label={label}
        overlay={overlay}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </div>
  )
}

function FullscreenStage({
  src,
  alt,
  sourceKind,
  onClose,
  label,
  overlay,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Required<Pick<FullscreenImageProps, 'src' | 'alt' | 'sourceKind' | 'onClose'>> &
  Pick<FullscreenImageProps, 'label' | 'overlay' | 'onPrev' | 'onNext'> & {
    hasPrev: boolean
    hasNext: boolean
  }) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  /** Chrome is everything painted over the photo: top bar, edge chevrons, bottom overlay. */
  const hasChrome = Boolean(overlay || onPrev || onNext)
  const [isChromeVisible, setIsChromeVisible] = useState(true)
  const hideTimerRef = useRef<number | null>(null)
  const isPointerOverChromeRef = useRef(false)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current === null) return
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }, [])

  /** Show the chrome and restart the idle countdown — unless the pointer is resting on it. */
  const revealChrome = useCallback(() => {
    setIsChromeVisible(true)
    clearHideTimer()
    if (isPointerOverChromeRef.current) return
    hideTimerRef.current = window.setTimeout(() => setIsChromeVisible(false), CHROME_IDLE_MS)
  }, [clearHideTimer])

  /** The controls start on screen and step aside once the juror has had a chance to read them. */
  useEffect(() => {
    hideTimerRef.current = window.setTimeout(() => setIsChromeVisible(false), CHROME_IDLE_MS)
    return clearHideTimer
  }, [clearHideTimer])

  const chromeHoverProps = {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      isPointerOverChromeRef.current = true
      clearHideTimer()
      setIsChromeVisible(true)
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      isPointerOverChromeRef.current = false
      revealChrome()
    },
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutBlockedTarget(e.target)) return

      revealChrome()

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        setScale((s) => Math.min(s * 1.2, 5))
      } else if (e.key === '-' || e.key === '_') {
        setScale((s) => {
          const newScale = Math.max(s / 1.2, 1)
          if (newScale === 1) {
            setPosition({ x: 0, y: 0 })
          }
          return newScale
        })
      } else if (e.key === 'ArrowLeft' && onPrev && hasPrev) {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight' && onNext && hasNext) {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext, hasPrev, hasNext, revealChrome])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => {
      const newScale = Math.max(1, Math.min(s * delta, 5))
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
      return newScale
    })
  }, [])

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setScale((s) => {
      if (s > 1) {
        setPosition({ x: 0, y: 0 })
        return 1
      }
      return 2
    })
  }, [])

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true)
        dragStartRef.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        }
      }
    },
    [scale, position],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && scale > 1) {
        setPosition({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        })
      }
    },
    [isDragging, scale],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const touchStartRef = useRef<{
    x: number
    y: number
    distance?: number
  } | null>(null)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (scale > 1) {
          touchStartRef.current = {
            x: e.touches[0]!.clientX - position.x,
            y: e.touches[0]!.clientY - position.y,
          }
        }
      } else if (e.touches.length === 2) {
        const distance = Math.hypot(
          e.touches[0]!.clientX - e.touches[1]!.clientX,
          e.touches[0]!.clientY - e.touches[1]!.clientY,
        )
        touchStartRef.current = {
          x: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2,
          y: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2,
          distance,
        }
      }
    },
    [scale, position],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 1 && touchStartRef.current && scale > 1) {
        setPosition({
          x: e.touches[0]!.clientX - touchStartRef.current.x,
          y: e.touches[0]!.clientY - touchStartRef.current.y,
        })
      } else if (e.touches.length === 2 && touchStartRef.current?.distance) {
        const distance = Math.hypot(
          e.touches[0]!.clientX - e.touches[1]!.clientX,
          e.touches[0]!.clientY - e.touches[1]!.clientY,
        )
        const scaleChange = distance / touchStartRef.current.distance
        setScale((s) => Math.max(1, Math.min(s * scaleChange, 5)))
        touchStartRef.current.distance = distance
      }
    },
    [scale],
  )

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
    if (scale === 1) {
      setPosition({ x: 0, y: 0 })
    }
  }, [scale])

  /**
   * With chrome on screen a tap belongs to it — it brings the controls back, or clears them out of
   * the way again. With none there is nothing to summon, so a backdrop tap still closes the viewer.
   */
  const handleStageClick = useCallback(
    (e: MouseEvent) => {
      if (scale !== 1) return

      if (hasChrome) {
        if (isChromeVisible) {
          clearHideTimer()
          setIsChromeVisible(false)
        } else {
          revealChrome()
        }
        return
      }

      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [clearHideTimer, hasChrome, isChromeVisible, onClose, revealChrome, scale],
  )

  const zoomIn = () => setScale((s) => Math.min(s * 1.3, 5))
  const zoomOut = () =>
    setScale((s) => {
      const newScale = Math.max(s / 1.3, 1)
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
      return newScale
    })

  const chromeClass = `transition-opacity duration-200 ${
    isChromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`

  return (
    <div
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPointerMove={revealChrome}
    >
      <div
        className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleStageClick}
      >
        <div
          className="relative flex h-full w-full items-center justify-center transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        >
          {sourceKind === 'original' ? (
            <SubmissionOptimizedOriginalImage
              src={src}
              alt={alt}
              className="h-full w-full select-none object-contain"
            />
          ) : sourceKind === 'thumbnail' ? (
            <SubmissionThumbnailImage
              src={src}
              alt={alt}
              className="h-full w-full select-none object-contain"
            />
          ) : (
            <SubmissionRawOriginalImage
              src={src}
              alt={alt}
              className="h-full w-full select-none object-contain"
            />
          )}
        </div>
      </div>

      <div
        {...chromeHoverProps}
        className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 via-black/40 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))] ${chromeClass}`}
      >
        <div className="flex min-w-0 items-center gap-3">{label}</div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 1}
              aria-label="Zoom out"
              className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="min-w-[60px] text-center text-sm text-white">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 5}
              aria-label="Zoom in"
              className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit fullscreen"
            className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {onPrev ? (
        <button
          type="button"
          {...chromeHoverProps}
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous"
          className={`absolute top-1/2 left-3 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 disabled:pointer-events-none disabled:opacity-0 ${chromeClass}`}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}

      {onNext ? (
        <button
          type="button"
          {...chromeHoverProps}
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next"
          className={`absolute top-1/2 right-3 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 disabled:pointer-events-none disabled:opacity-0 ${chromeClass}`}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      {overlay ? (
        <div
          {...chromeHoverProps}
          className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] ${chromeClass}`}
        >
          {overlay}
        </div>
      ) : (
        <div
          className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 pb-[env(safe-area-inset-bottom)] text-center text-sm text-white/60 ${chromeClass}`}
        >
          <p>Double-click or pinch to zoom • Drag to pan</p>
        </div>
      )}
    </div>
  )
}
