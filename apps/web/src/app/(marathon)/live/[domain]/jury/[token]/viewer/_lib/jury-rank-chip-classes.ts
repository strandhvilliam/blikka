/** Rank chips — aligned with `JurySubmissionViewer` toolbar picks */

export const juryRankChipBase =
  "inline-flex min-h-10 min-w-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 active:scale-[0.98]";

const interactive = "cursor-pointer";

export const juryRankChipActive = `${juryRankChipBase} ${interactive} border-brand-primary bg-brand-primary text-white shadow-[0_4px_16px_rgba(254,77,58,0.22)] hover:brightness-[1.03]`;

/** Assigned rank, another participant or “other holder” in detail view */
export const juryRankChipNeutralOccupied = `${juryRankChipBase} ${interactive} border-border/60 bg-neutral-50 text-brand-black hover:border-brand-primary/35 hover:bg-white hover:shadow-md`;

/** Empty slot in detail view */
export const juryRankChipNeutralSlot = `${juryRankChipBase} ${interactive} border-border/60 bg-neutral-50 text-brand-black hover:border-brand-primary/40 hover:bg-neutral-100 hover:shadow-md`;

/** Top picks row: unassigned slot (non-interactive) */
export const juryRankChipNeutralPlaceholder = `${juryRankChipBase} border-border/60 bg-neutral-50 text-brand-black`;

/** List card: compact chip next to participant id */
export const juryRankChipCardBadge =
  "inline-flex min-h-8 min-w-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-brand-black shadow-sm";
