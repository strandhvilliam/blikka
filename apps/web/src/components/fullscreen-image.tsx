"use client"

import type { MouseEvent, TouchEvent, WheelEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { X, ZoomIn, ZoomOut } from "lucide-react"

export type FullscreenImageProps = {
  src: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

const isFullscreenSupported =
  typeof document !== "undefined" &&
  "fullscreenEnabled" in document &&
  document.fullscreenEnabled

export function FullscreenImage({
  src,
  alt,
  isOpen,
  onClose,
}: FullscreenImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

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
    if (!isFullscreenSupported) return

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isOpen) {
        onClose()
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalWidth = document.body.style.width
    const originalHeight = document.body.style.height
    const originalTouchAction = document.body.style.touchAction

    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.width = "100%"
    document.body.style.height = "100%"
    document.body.style.touchAction = "none"

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.width = originalWidth
      document.body.style.height = originalHeight
      document.body.style.touchAction = originalTouchAction
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(s * 1.2, 5))
      } else if (e.key === "-" || e.key === "_") {
        setScale((s) => {
          const newScale = Math.max(s / 1.2, 1)
          if (newScale === 1) {
            setPosition({ x: 0, y: 0 })
          }
          return newScale
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

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

  const zoomIn = () => setScale((s) => Math.min(s * 1.3, 5))
  const zoomOut = () =>
    setScale((s) => {
      const newScale = Math.max(s / 1.3, 1)
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
      return newScale
    })

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="z-10 flex items-center justify-between bg-black/50 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 1}
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
            className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 disabled:opacity-50"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget && scale === 1) {
            onClose()
          }
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full select-none object-contain"
            draggable={false}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 pb-[env(safe-area-inset-bottom)] text-center text-sm text-white/60">
        <p>Double-click or pinch to zoom • Drag to pan</p>
      </div>
    </div>
  )
}
