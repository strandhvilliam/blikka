"use client"

import { Textarea } from "@/components/ui/textarea"
import { Loader2, MessageSquare, Star } from "lucide-react"
import type { ChangeEvent } from "react"
import type { JuryInvitation } from "../../_lib/jury-types"
import type { JuryListParticipant } from "../_lib/jury-list-participant"

export function JurySidebar({
  participant,
  invitation,
  rating,
  notes,
  isSaving,
  onRatingClick,
  onNotesChange,
}: {
  participant: JuryListParticipant
  invitation: JuryInvitation
  rating: number
  notes: string
  isSaving: boolean
  onRatingClick: (star: number) => void
  onNotesChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <div className="w-full space-y-3 xl:sticky xl:top-6">
      <div className="rounded-xl border border-border/60 bg-white p-5">
        <h2 className="font-rocgrotesk text-3xl font-bold tracking-tight text-brand-black">
          #{participant.reference}
        </h2>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {participant.submission?.topic?.name ? (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
              {participant.submission.topic.name}
            </span>
          ) : null}
          {participant.competitionClass?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
              {participant.competitionClass.name}
            </span>
          ) : null}
          {participant.deviceGroup?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
              {participant.deviceGroup.name}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-brand-gray">
          {invitation.inviteType === "class"
            ? "Review the generated contact sheet for this participant."
            : "Review the submission for the assigned topic."}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
            Rating
          </p>
          {isSaving ? (
            <span className="flex items-center gap-1 text-[11px] text-brand-gray">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="rounded-full p-1.5 transition-transform duration-100 hover:scale-110 active:scale-95"
              onClick={() => onRatingClick(star)}
            >
              <Star
                className={`h-6 w-6 transition-colors duration-100 ${
                  star <= rating
                    ? "fill-brand-primary text-brand-primary"
                    : "text-neutral-200 hover:text-neutral-300"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-brand-gray">
          {rating > 0 ? `${rating} of 5` : "Tap to rate"}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-brand-gray" />
          <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
            Notes
          </p>
        </div>
        <Textarea
          placeholder="Your observations on this submission..."
          className="mt-3 min-h-36 resize-none border-border/60 bg-neutral-50 text-sm placeholder:text-brand-gray/50 focus-visible:ring-brand-primary/20"
          value={notes}
          onChange={onNotesChange}
        />
      </div>
    </div>
  )
}
