import { describe, expect, it } from 'vitest'

import { buildJuryImageArchivePlan } from './jury-results-images'
import type { JuryDomainResult } from './jury-results'

function participant(
  id: number,
  reference: string,
  overrides: Partial<{
    firstname: string
    lastname: string
    submissionKey: string | null
    submissionThumbnailKey: string | null
    contactSheetKey: string | null
  }> = {},
) {
  return {
    id,
    reference,
    firstname: 'Ada',
    lastname: 'Lovelace',
    submissionKey: `demo/${reference}/original.jpg`,
    submissionThumbnailKey: `demo/${reference}/thumb.webp`,
    contactSheetKey: null,
    ...overrides,
  }
}

function pick(id: number, reference: string, isWinner = false, overrides = {}) {
  return { participantId: id, isWinner, participant: participant(id, reference, overrides) }
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

const options = { domain: 'demo', dateStamp: '2026-08-30' } as const

describe('jury image archive plan', () => {
  it('files a juror shortlist winner-first under its scope, then by reference', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({
          invitationId: 1,
          displayName: 'Ada Lovelace',
          shortlist: [pick(10, '10'), pick(20, '20', true), pick(5, '5')],
        }),
      ],
      options,
    )

    expect(plan.files.map((file) => file.path)).toEqual([
      'jury-result-images-demo-2026-08-30/01-topic-reflections/01-ada-lovelace/01-winner-0020-ada-lovelace.jpg',
      'jury-result-images-demo-2026-08-30/01-topic-reflections/01-ada-lovelace/02-shortlist-0005-ada-lovelace.jpg',
      'jury-result-images-demo-2026-08-30/01-topic-reflections/01-ada-lovelace/03-shortlist-0010-ada-lovelace.jpg',
    ])
    expect(plan.files.every((file) => file.bucket === 'submissions')).toBe(true)
  })

  it('numbers scopes in competition order and jurors alphabetically inside one', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({
          invitationId: 2,
          displayName: 'Grace Hopper',
          topic: { id: 2, name: 'Blue Hour', orderIndex: 1 },
          shortlist: [pick(1, '1', true)],
        }),
        makeResult({
          invitationId: 3,
          displayName: 'Bo Nilsson',
          shortlist: [pick(2, '2', true)],
        }),
        makeResult({
          invitationId: 1,
          displayName: 'Ada Lovelace',
          shortlist: [pick(3, '3', true)],
        }),
      ],
      options,
    )

    expect(plan.files.map((file) => file.path.split('/').slice(1, 3).join('/'))).toEqual([
      '01-topic-reflections/01-ada-lovelace',
      '01-topic-reflections/02-bo-nilsson',
      '02-topic-blue-hour/01-grace-hopper',
    ])
  })

  it('names a class scope by class and device group, and marks its contact sheets', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({
          invitationId: 1,
          displayName: 'Ada Lovelace',
          inviteType: 'class',
          topic: null,
          competitionClass: { id: 4, name: 'Youth' },
          deviceGroup: { id: 7, name: 'Mobile Phone' },
          shortlist: [
            pick(1, '1', true, {
              submissionKey: null,
              submissionThumbnailKey: null,
              contactSheetKey: 'demo/1/sheet.png',
            }),
          ],
        }),
      ],
      options,
    )

    expect(plan.files).toEqual([
      {
        bucket: 'contact-sheets',
        key: 'demo/1/sheet.png',
        path: 'jury-result-images-demo-2026-08-30/01-class-youth-mobile-phone/01-ada-lovelace/01-winner-0001-ada-lovelace-contact-sheet.png',
      },
    ])
  })

  it('takes the original submission for a pick that is not a contact sheet', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({
          invitationId: 1,
          shortlist: [pick(1, '1', true), pick(2, '2', false, { submissionThumbnailKey: null })],
        }),
      ],
      options,
    )

    expect(plan.files.map((file) => [file.bucket, file.key])).toEqual([
      ['submissions', 'demo/1/original.jpg'],
      ['submissions', 'demo/2/original.jpg'],
    ])
  })

  it('counts an entry two jurors picked once as an object and twice as a zip entry', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({ invitationId: 1, displayName: 'Ada', shortlist: [pick(1, '1', true)] }),
        makeResult({ invitationId: 2, displayName: 'Bo', shortlist: [pick(1, '1', true)] }),
      ],
      options,
    )

    expect(plan.entryCount).toBe(2)
    expect(plan.distinctObjectCount).toBe(1)
  })

  it('marks a juror who has picked nothing rather than leaving the folder out', () => {
    const plan = buildJuryImageArchivePlan(
      [makeResult({ invitationId: 1, displayName: 'Ada Lovelace', shortlist: [] })],
      options,
    )

    expect(plan.files).toEqual([])
    expect(
      plan.textFiles.some((file) =>
        file.path.endsWith('01-topic-reflections/01-ada-lovelace/no-picks.txt'),
      ),
    ).toBe(true)
  })

  it('records a pick with no image on record instead of dropping it silently', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({
          invitationId: 1,
          inviteType: 'custom',
          topic: null,
          shortlist: [
            pick(1, '1', true, {
              firstname: 'Nils',
              lastname: 'Åberg',
              submissionKey: null,
              submissionThumbnailKey: null,
            }),
          ],
        }),
      ],
      options,
    )

    const readme = plan.textFiles.find((file) => file.path.endsWith('README.txt'))

    expect(plan.files).toEqual([])
    expect(readme?.content).toContain('IMAGES NOT AVAILABLE')
    expect(readme?.content).toContain('#1 Nils Åberg')
  })

  it('keeps the full jury numbering when the archive is filtered to one juror', () => {
    const results = [
      makeResult({ invitationId: 1, displayName: 'Ada', shortlist: [pick(1, '1', true)] }),
      makeResult({ invitationId: 2, displayName: 'Bo', shortlist: [pick(2, '2', true)] }),
    ]

    const plan = buildJuryImageArchivePlan(results, {
      ...options,
      filter: { invitationId: 2 },
    })

    expect(plan.files.map((file) => file.path.split('/')[2])).toEqual(['02-bo'])
  })

  it('writes the results csv it was handed alongside the readme', () => {
    const plan = buildJuryImageArchivePlan(
      [makeResult({ invitationId: 1, shortlist: [pick(1, '1', true)] })],
      { ...options, csv: 'participant_reference\r\n0001\r\n' },
    )

    expect(plan.textFiles.find((file) => file.path.endsWith('jury-results.csv'))?.content).toBe(
      'participant_reference\r\n0001\r\n',
    )
  })

  it('falls back to safe segments for names that sanitize to nothing', () => {
    const plan = buildJuryImageArchivePlan(
      [
        makeResult({
          invitationId: 1,
          displayName: '???',
          topic: { id: 1, name: '???', orderIndex: 2 },
          shortlist: [pick(1, '1', true, { firstname: '', lastname: '' })],
        }),
      ],
      options,
    )

    expect(plan.files[0]?.path).toBe(
      'jury-result-images-demo-2026-08-30/01-topic-topic-3/01-juror/01-winner-0001.jpg',
    )
  })
})
