import { describe, expect, it } from 'vitest'

import {
  getJuryScopeKey,
  getJuryScopeLabel,
  groupJuryResultsByScope,
  type JuryDomainResult,
} from './jury-results'

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
    winner: shortlist.find((pick) => pick.isWinner)?.participant ?? null,
    ...overrides,
    shortlist,
  } as JuryDomainResult
}

function pick(id: number, reference: string, isWinner = false) {
  return { participantId: id, isWinner, participant: participant(id, reference) }
}

describe('jury scope identity', () => {
  it('groups topic invites by topic', () => {
    expect(getJuryScopeKey(makeResult({ invitationId: 1 }))).toBe('topic:1')
    expect(getJuryScopeLabel(makeResult({ invitationId: 1 }))).toBe('Topic 1: Reflections')
  })

  it('keeps a class split across device groups apart', () => {
    const base = {
      inviteType: 'class' as const,
      topic: null,
      competitionClass: { id: 7, name: 'Youth' },
    }
    const phones = makeResult({
      invitationId: 1,
      ...base,
      deviceGroup: { id: 2, name: 'Phone' },
    })
    const cameras = makeResult({
      invitationId: 2,
      ...base,
      deviceGroup: { id: 3, name: 'Camera' },
    })

    expect(getJuryScopeKey(phones)).not.toBe(getJuryScopeKey(cameras))
    expect(getJuryScopeLabel(phones)).toBe('Youth · Phone')
  })

  it('never merges jurors whose scope failed to resolve', () => {
    const first = makeResult({ invitationId: 1, topic: null })
    const second = makeResult({ invitationId: 2, topic: null })

    expect(getJuryScopeKey(first)).not.toBe(getJuryScopeKey(second))
  })
})

describe('grouping jury results by scope', () => {
  it('orders topics by competition order and puts classes last', () => {
    const groups = groupJuryResultsByScope([
      makeResult({
        invitationId: 1,
        inviteType: 'class',
        topic: null,
        competitionClass: { id: 9, name: 'Open' },
      }),
      makeResult({ invitationId: 2, topic: { id: 5, name: 'Motion', orderIndex: 2 } }),
      makeResult({ invitationId: 3, topic: { id: 4, name: 'Light', orderIndex: 1 } }),
    ])

    expect(groups.map((group) => group.label)).toEqual([
      'Topic 2: Light',
      'Topic 3: Motion',
      'Open',
    ])
  })

  it('ranks winners above shared shortlist picks in the consensus', () => {
    const [group] = groupJuryResultsByScope([
      makeResult({
        invitationId: 1,
        displayName: 'Ada',
        shortlist: [pick(10, '10'), pick(20, '20', true)],
      }),
      makeResult({
        invitationId: 2,
        displayName: 'Grace',
        shortlist: [pick(10, '10'), pick(30, '30', true)],
      }),
    ])

    expect(group!.consensus.map((entry) => entry.participant.reference)).toEqual(['20', '30', '10'])
    expect(group!.consensus[0]).toMatchObject({ wonBy: 1, shortlistedBy: 1 })
    // Picked by both jurors but won neither, so it ranks below the two winners.
    expect(group!.consensus[2]).toMatchObject({ wonBy: 0, shortlistedBy: 2 })
  })

  it('lists jurors alphabetically inside a scope', () => {
    const [group] = groupJuryResultsByScope([
      makeResult({ invitationId: 1, displayName: 'Zoe' }),
      makeResult({ invitationId: 2, displayName: 'Ada' }),
    ])

    expect(group!.jurors.map((juror) => juror.displayName)).toEqual(['Ada', 'Zoe'])
  })
})
