"use client";

import * as React from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

interface FullscreenImageProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

// Check if fullscreen API is supported
const isFullscreenSupported =
  typeof document !== "undefined" &&
  "fullscreenEnabled" in document &&
  document.fullscreenEnabled;

export function FullscreenImage({
  src,
  alt,
  isOpen,
  onClose,
}: FullscreenImageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });

  // Handle fullscreen API (only on supported browsers)
  React.useEffect(() => {
    if (!containerRef.current || !isFullscreenSupported) return;

    if (isOpen) {
      containerRef.current.requestFullscreen?.().catch(() => {
        // Fallback: still show the modal even if fullscreen fails
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {
        // Ignore errors
      });
    }
  }, [isOpen]);

  // Handle fullscreen change events (e.g., user presses Escape)
  React.useEffect(() => {
    if (!isFullscreenSupported) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isOpen) {
        onClose();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open (especially important for iOS)
  React.useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const originalHeight = document.body.style.height;
    const originalTouchAction = document.body.style.touchAction;

    // Prevent scrolling on body
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.height = originalHeight;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Handle keyboard events
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(s * 1.2, 5));
      } else if (e.key === "-" || e.key === "_") {
        setScale((s) => {
          const newScale = Math.max(s / 1.2, 1);
          if (newScale === 1) {
            setPosition({ x: 0, y: 0 });
          }
          return newScale;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle wheel zoom
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => {
      const newScale = Math.max(1, Math.min(s * delta, 5));
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  // Handle double tap/click to zoom
  const handleDoubleClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setScale((s) => {
      if (s > 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  // Handle drag/pan when zoomed
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        };
      }
    },
    [scale, position],
  );

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && scale > 1) {
        setPosition({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      }
    },
    [isDragging, scale],
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle touch events for mobile pinch zoom and pan
  const touchStartRef = React.useRef<{
    x: number;
    y: number;
    distance?: number;
  } | null>(null);

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        // Single finger - pan
        if (scale > 1) {
          touchStartRef.current = {
            x: e.touches[0].clientX - position.x,
            y: e.touches[0].clientY - position.y,
          };
        }
      } else if (e.touches.length === 2) {
        // Two fingers - pinch zoom
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        touchStartRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          distance,
        };
      }
    },
    [scale, position],
  );

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && touchStartRef.current && scale > 1) {
        // Single finger pan
        setPosition({
          x: e.touches[0].clientX - touchStartRef.current.x,
          y: e.touches[0].clientY - touchStartRef.current.y,
        });
      } else if (e.touches.length === 2 && touchStartRef.current?.distance) {
        // Pinch zoom
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const scaleChange = distance / touchStartRef.current.distance;
        setScale((s) => Math.max(1, Math.min(s * scaleChange, 5)));
        touchStartRef.current.distance = distance;
      }
    },
    [scale],
  );

  const handleTouchEnd = React.useCallback(() => {
    touchStartRef.current = null;
    if (scale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s * 1.3, 5));
  const zoomOut = () =>
    setScale((s) => {
      const newScale = Math.max(s / 1.3, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-[100] flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 bg-black/50 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 1}
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 5}
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Image container */}
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // Close on background click if not dragging and not zoomed
          if (e.target === e.currentTarget && scale === 1) {
            onClose();
          }
        }}
      >
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Footer hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <p>Double-click or pinch to zoom • Drag to pan</p>
      </div>
    </div>
  );
}
