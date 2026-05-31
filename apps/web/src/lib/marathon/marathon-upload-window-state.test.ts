import { describe, expect, it } from 'vitest'

import { getMarathonUploadWindowState } from './marathon-upload-window-state'

const now = new Date('2026-05-21T12:00:00.000Z')

describe('getMarathonUploadWindowState', () => {
  it('returns not-configured when setup is incomplete', () => {
    expect(
      getMarathonUploadWindowState(
        {
          setupCompleted: false,
          startDate: '2026-05-21T10:00:00.000Z',
          endDate: '2026-05-21T18:00:00.000Z',
        },
        now,
      ),
    ).toBe('not-configured')
  })

  it('returns not-configured when upload dates are missing', () => {
    expect(
      getMarathonUploadWindowState(
        {
          setupCompleted: true,
          startDate: null,
          endDate: null,
        },
        now,
      ),
    ).toBe('not-configured')
  })

  it('returns scheduled before the upload window opens', () => {
    expect(
      getMarathonUploadWindowState(
        {
          setupCompleted: true,
          startDate: '2026-05-21T13:00:00.000Z',
          endDate: '2026-05-21T18:00:00.000Z',
        },
        now,
      ),
    ).toBe('scheduled')
  })

  it('returns open during the upload window', () => {
    expect(
      getMarathonUploadWindowState(
        {
          setupCompleted: true,
          startDate: '2026-05-21T10:00:00.000Z',
          endDate: '2026-05-21T18:00:00.000Z',
        },
        now,
      ),
    ).toBe('open')
  })

  it('returns closed after the upload window ends', () => {
    expect(
      getMarathonUploadWindowState(
        {
          setupCompleted: true,
          startDate: '2026-05-21T08:00:00.000Z',
          endDate: '2026-05-21T11:00:00.000Z',
        },
        now,
      ),
    ).toBe('closed')
  })
})
