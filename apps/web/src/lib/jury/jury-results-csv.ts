import type { CsvCell } from '@/lib/csv'

import { groupJuryResultsByScope, type JuryDomainResult, type JuryScopeGroup } from './jury-results'
import { compareParticipantReferences } from './jury-utils'

/**
 * The jury verdict as a flat table: one row per juror per shortlisted entry. Long format rather
 * than one column per juror, so an organizer can pivot or filter it without the columns changing
 * shape when a juror is added.
 */
export const JURY_RESULTS_CSV_HEADERS = [
  'participant_firstname',
  'participant_lastname',
  'participant_reference',
  'scope',
  'topic_order',
  'juror_name',
  'juror_email',
  'juror_status',
  'is_winner',
  'shortlisted_by_jurors',
  'won_by_jurors',
  'jurors_in_scope',
] as const

export type JuryResultsCsvHeader = (typeof JURY_RESULTS_CSV_HEADERS)[number]
export type JuryResultsCsvRow = Record<JuryResultsCsvHeader, CsvCell>

/**
 * Invite types outside topic and class ('all', 'custom', 'device') resolve to neither, and the
 * grouped label falls back to a bare "Class" for them. The file names the invite instead of
 * mislabelling it.
 */
function formatScope(group: JuryScopeGroup, juror: JuryDomainResult): string {
  if (juror.inviteType === 'topic' || juror.inviteType === 'class') {
    return group.label
  }

  return `${juror.inviteType} · ${juror.displayName}`
}

/** Winner first — the shortlist itself carries no ranking, so the rest go by reference. */
function sortPicksForExport(shortlist: JuryDomainResult['shortlist']) {
  return shortlist.toSorted((left, right) => {
    if (left.isWinner !== right.isWinner) return left.isWinner ? -1 : 1
    return compareParticipantReferences(left.participant, right.participant)
  })
}

/**
 * Rows follow the Results tab: topics in competition order, then classes, jurors alphabetically
 * inside a scope. The consensus counts are repeated on every row of a scope so that filtering on
 * `won_by_jurors` alone answers "where did the jury agree" without a pivot.
 */
export function buildJuryResultsCsvRows(results: readonly JuryDomainResult[]): JuryResultsCsvRow[] {
  const rows: JuryResultsCsvRow[] = []

  for (const group of groupJuryResultsByScope([...results])) {
    const consensusByParticipantId = new Map(
      group.consensus.map((entry) => [entry.participant.id, entry] as const),
    )

    for (const juror of group.jurors) {
      const jurorColumns = {
        scope: formatScope(group, juror),
        topic_order: juror.topic ? juror.topic.orderIndex + 1 : '',
        juror_name: juror.displayName,
        juror_email: juror.email,
        juror_status: juror.status ?? '',
        jurors_in_scope: group.jurors.length,
      }

      // Every row is a pick, so a juror who has decided nothing contributes none: a blank
      // participant row carries nothing an organizer can act on.
      for (const pick of sortPicksForExport(juror.shortlist)) {
        const consensus = consensusByParticipantId.get(pick.participant.id)

        rows.push({
          ...jurorColumns,
          participant_reference: pick.participant.reference,
          participant_firstname: pick.participant.firstname,
          participant_lastname: pick.participant.lastname,
          is_winner: pick.isWinner ? 'yes' : 'no',
          shortlisted_by_jurors: consensus?.shortlistedBy ?? 1,
          won_by_jurors: consensus?.wonBy ?? 0,
        })
      }
    }
  }

  return rows
}
