import { cn } from '@/lib/utils'

/**
 * Pure-CSS justified photo rows (Flickr / Lightroom style). Each child is a flex item
 * whose `flex-basis`/`flex-grow` are derived from its aspect ratio (see GalleryPhoto), so
 * portrait and landscape shots keep their proportions and rows stay equal height.
 *
 * SSR-friendly with no client measurement and no layout shift. The row height is exposed
 * as the `--gallery-row-h` CSS variable so callers can tune density per breakpoint by
 * overriding it via `className`. The dense `feed` variant butts tiles edge-to-edge (no
 * gap) for a seamless exhibition-wall mosaic; the `showcase` variant adds a gutter so
 * winner photos read as distinct, separated hero pieces.
 *
 * A trailing zero-size spacer with a very large `flex-grow` absorbs the slack on a short
 * final row, so the last row stays left-aligned at natural size instead of stretching.
 * For an infinite feed it is omitted while more pages are loading (`hasMore`) — otherwise
 * the incomplete last row would render un-stretched and then jump once the next page
 * lands. It is rendered only once the grid is complete.
 *
 * For a finite, curated set (`stretchLastRow`) the spacer is dropped entirely so the last
 * row justifies (stretches + crops) like the rows above it, rather than reverting to the
 * tiles' natural aspect and reading as a mismatched final row.
 */
// Row-height (and gutter) set per variant. Kept mutually exclusive (never combined) so
// the responsive cascade within a set stays predictable. `feed` is seamless; `showcase`
// adds a gutter so winners stand apart.
const VARIANT_CLASS: Record<'feed' | 'showcase', string> = {
  feed: '[--gallery-row-h:200px] sm:[--gallery-row-h:280px] lg:[--gallery-row-h:340px]',
  showcase:
    'gap-2 sm:gap-3 [--gallery-row-h:230px] sm:[--gallery-row-h:300px] lg:[--gallery-row-h:340px]',
}

export function JustifiedGrid({
  children,
  variant = 'feed',
  className,
  hasMore = false,
  stretchLastRow = false,
}: {
  children: React.ReactNode
  /** `feed` for dense browse grids, `showcase` for taller winner rows. */
  variant?: 'feed' | 'showcase'
  className?: string
  /** When more items are still loading, skip the end spacer so the last row stays justified. */
  hasMore?: boolean
  /** For a finite set, drop the spacer so the last row stretches/crops like the rows above. */
  stretchLastRow?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap', VARIANT_CLASS[variant], className)}>
      {children}
      {hasMore || stretchLastRow ? null : (
        <span
          aria-hidden
          className="min-w-0 grow"
          style={{ flexGrow: 999, flexBasis: 0, height: 0 }}
        />
      )}
    </div>
  )
}
