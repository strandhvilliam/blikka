'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Heart, Star, Trophy } from 'lucide-react'
import { toast } from 'sonner'

type JuryRatingRow = {
  participantId: number
  rating: number
  notes: string | null
  participant: {
    id: number
    reference: string
    firstname: string
    lastname: string
  }
}

/** A rating row joined with where the participant sits on the juror's shortlist. */
type JuryRatingTableRow = JuryRatingRow & {
  isShortlisted: boolean
  isWinner: boolean
}

function escapeCsvCell(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadJuryRatingsCsv(ratings: JuryRatingTableRow[]) {
  const header = ['reference', 'firstname', 'lastname', 'rating', 'shortlisted', 'winner', 'notes']
  const rows = ratings.map((row) => [
    row.participant.reference,
    row.participant.firstname,
    row.participant.lastname,
    String(row.rating),
    row.isShortlisted ? 'yes' : 'no',
    row.isWinner ? 'yes' : 'no',
    row.notes ?? '',
  ])

  const csv = [header, ...rows]
    .map((line) => line.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'jury-ratings.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Winner first, then the rest of the shortlist, then everything else by star rating. */
function sortRatings(ratings: JuryRatingTableRow[]) {
  const pickWeight = (row: JuryRatingTableRow) => (row.isWinner ? 0 : row.isShortlisted ? 1 : 2)

  return ratings.toSorted((left, right) => {
    const weightDiff = pickWeight(left) - pickWeight(right)
    if (weightDiff !== 0) return weightDiff
    return right.rating - left.rating
  })
}

export function JuryRatingsTable({
  ratings,
  shortlist,
}: {
  ratings: JuryRatingRow[]
  shortlist: { participantId: number; isWinner: boolean }[]
}) {
  const shortlistByParticipantId = new Map(
    shortlist.map((pick) => [pick.participantId, pick] as const),
  )
  const sorted = sortRatings(
    ratings.map((row) => {
      const pick = shortlistByParticipantId.get(row.participantId)
      return {
        ...row,
        isShortlisted: pick !== undefined,
        isWinner: pick?.isWinner ?? false,
      }
    }),
  )

  const handleExport = () => {
    if (sorted.length === 0) {
      toast.error('No ratings to export yet')
      return
    }
    downloadJuryRatingsCsv(sorted)
    toast.success('Ratings exported')
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-brand-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            All ratings
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleExport}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">No ratings recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full min-w-0 text-left text-[13px]">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="px-3 py-2 font-semibold text-muted-foreground">Ref</th>
                <th className="px-3 py-2 font-semibold text-muted-foreground">Rating</th>
                <th className="px-3 py-2 font-semibold text-muted-foreground">Pick</th>
                <th className="px-3 py-2 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.participantId} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-medium tabular-nums">#{row.participant.reference}</td>
                  <td className="px-3 py-2">
                    {row.rating > 0 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-brand-primary text-brand-primary" />
                        {row.rating}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.isWinner ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Trophy className="h-3 w-3 text-amber-600" />
                        Winner
                      </Badge>
                    ) : row.isShortlisted ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Heart className="h-3 w-3 fill-brand-primary text-brand-primary" />
                        Shortlisted
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground" title={row.notes ?? undefined}>
                    {row.notes?.trim() ? row.notes : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
