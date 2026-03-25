"use client"

export function ProgressRing({ rated, total }: { rated: number; total: number }) {
  const pct = total > 0 ? (rated / total) * 100 : 0
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="-rotate-90" width="48" height="48" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-neutral-100"
        />
        <circle
          cx="24"
          cy="24"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-brand-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-brand-black">
        {Math.round(pct)}%
      </span>
    </div>
  )
}
