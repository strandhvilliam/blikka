import { describe, expect, it } from 'vitest'

import { buildJuryResultsCsvRows, JURY_RESULTS_CSV_HEADERS } from './jury-results-csv'
import type { JuryDomainResult } from './jury-results'

function participant(id: number, reference: string) {
  return {
    id,
    reference,
    firstname: 'First',
    lastname: 'Last',
    submissionKey: null,
    submissionThumbnailKey: null,
    contactSheetKey: null,
  }
}

function pick(id: number, reference: string, isWinner = false) {
  return { participantId: id, isWinner, participant: participant(id, reference) }
}

function makeResult(overrides: Partial<JuryDomainResult> & { invitationId: number }) {
  const shortlist = overrides.shortlist ?? []
  return {
    displayName: 'Juror',
    email: 'juror@example.com',
    status: 'completed',
    inviteType: 'topic',
    topic: { id: 1, name: 'Reflections', orderIndex: 0 },
    competitionClass: null,
    deviceGroup: null,
    winner: shortlist.find((entry) => entry.isWinner)?.participant ?? null,
    ...overrides,
    shortlist,
  } as JuryDomainResult
}

describe('jury results csv rows', () => {
  it('emits one row per juror per shortlisted entry, winner first', () => {
    const rows = buildJuryResultsCsvRows([
      makeResult({
        invitationId: 1,
        displayName: 'Ada',
        email: 'ada@example.com',
        shortlist: [pick(10, '10'), pick(20, '20', true), pick(5, '5')],
      }),
    ])

    expect(rows.map((row) => [row.participant_reference, row.is_winner])).toEqual([
      ['20', 'yes'],
      ['5', 'no'],
      ['10', 'no'],
    ])
    expect(rows[0]).toMatchObject({
      scope_type: 'topic',
      scope: 'Topic 1: Reflections',
      topic_order: 1,
      juror_name: 'Ada',
      juror_email: 'ada@example.com',
      juror_status: 'completed',
      jurors_in_scope: 1,
    })
  })

  it('repeats the scope consensus counts on every row of that scope', () => {
    const rows = buildJuryResultsCsvRows([
      makeResult({
        invitationId: 1,
        displayName: 'Ada',
        shortlist: [pick(10, '10'), pick(20, '20', true)],
      }),
      makeResult({
        invitationId: 2,
        displayName: 'Grace',
        shortlist: [pick(10, '10'), pick(20, '20', true)],
      }),
    ])

    const shared = rows.filter((row) => row.participant_reference === '20')
    expect(shared).toHaveLength(2)
    for (const row of shared) {
      expect(row).toMatchObject({ shortlisted_by_jurors: 2, won_by_jurors: 2, jurors_in_scope: 2 })
    }

    const onlyShortlisted = rows.filter((row) => row.participant_reference === '10')
    expect(onlyShortlisted[0]).toMatchObject({ shortlisted_by_jurors: 2, won_by_jurors: 0 })
  })

  it('keeps a juror who has picked nothing, with the entry columns blank', () => {
    const rows = buildJuryResultsCsvRows([
      makeResult({ invitationId: 1, displayName: 'Ada', status: 'pending' }),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      juror_name: 'Ada',
      juror_status: 'pending',
      participant_reference: '',
      is_winner: '',
      shortlisted_by_jurors: '',
      won_by_jurors: '',
    })
  })

  it('orders topics by competition order, then classes, jurors alphabetically', () => {
    const rows = buildJuryResultsCsvRows([
      makeResult({
        invitationId: 1,
        displayName: 'Zoe',
        inviteType: 'class',
        topic: null,
        competitionClass: { id: 9, name: 'Open' },
        deviceGroup: { id: 3, name: 'Camera' },
      }),
      makeResult({
        invitationId: 2,
        displayName: 'Zoe',
        topic: { id: 5, name: 'Motion', orderIndex: 2 },
      }),
      makeResult({
        invitationId: 3,
        displayName: 'Ada',
        topic: { id: 5, name: 'Motion', orderIndex: 2 },
      }),
    ])

    expect(rows.map((row) => [row.scope, row.juror_name])).toEqual([
      ['Topic 3: Motion', 'Ada'],
      ['Topic 3: Motion', 'Zoe'],
      ['Open · Camera', 'Zoe'],
    ])
    // A class review has no place in the topic running order, so the column stays empty.
    expect(rows[2]!.topic_order).toBe('')
  })

  it('names invite types that resolve to neither a topic nor a class', () => {
    const rows = buildJuryResultsCsvRows([
      makeResult({
        invitationId: 1,
        displayName: 'Ada',
        inviteType: 'all',
        topic: null,
      }),
    ])

    expect(rows[0]).toMatchObject({ scope_type: 'all', scope: 'all · Ada' })
  })

  it('covers every declared header', () => {
    const rows = buildJuryResultsCsvRows([
      makeResult({ invitationId: 1, shortlist: [pick(10, '10', true)] }),
    ])

    expect(Object.keys(rows[0]!).toSorted()).toEqual([...JURY_RESULTS_CSV_HEADERS].toSorted())
  })
})
