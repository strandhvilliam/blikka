"use client"

import { Star } from "lucide-react"

export function RatingFilterBar({
  selectedRatings,
  onToggle,
  isPending = false,
}: {
  selectedRatings: number[]
  onToggle: (rating: number) => void
  isPending?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-white px-2.5 py-1.5">
      {[0, 1, 2, 3, 4, 5].map((rating) => {
        const isActive = selectedRatings.includes(rating)
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onToggle(rating)}
            aria-busy={isPending}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
              isActive
                ? "bg-brand-primary text-white"
                : "bg-neutral-50 text-brand-gray hover:bg-neutral-100 hover:text-brand-black"
            } ${isPending ? "opacity-80" : ""}`}
          >
            {rating === 0 ? (
              "Unrated"
            ) : (
              <>
                <Star className={`h-3 w-3 ${isActive ? "fill-white" : "fill-current"}`} />
                {rating}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ActiveRatingFilterBadge({ selectedRatings }: { selectedRatings: number[] }) {
  if (selectedRatings.length === 0) {
    return null
  }

  const [rating] = selectedRatings

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-neutral-50 px-3 py-2 text-xs font-medium text-brand-gray">
      {rating === 0 ? (
        "Unrated only"
      ) : (
        <>
          <Star className="h-3 w-3 fill-current" />
          {rating}-star only
        </>
      )}
    </div>
  )
}
