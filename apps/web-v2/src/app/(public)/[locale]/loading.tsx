"use client"

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-2xl">
      <div className="flex flex-col items-center gap-6">
        <img
          src="/blikka-logo-dark.svg"
          alt="blikka"
          width={48}
          height={40}
          className="h-10 w-auto animate-pulse"
        />
      </div>
    </div>
  )
}
