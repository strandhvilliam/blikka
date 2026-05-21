import { Cause, Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'
import type { Topic } from '@blikka/db'

import { BadRequestError } from '../errors'
import {
  createRandomReference,
  createUploadSessionId,
  ensureMarathonIsOpenForUploads,
} from './utils'

const domain = 'demo'
const now = new Date('2026-05-21T12:00:00.000Z')

type MarathonInput = Parameters<typeof ensureMarathonIsOpenForUploads>[0]['marathon']

const makeMarathon = (overrides: Partial<MarathonInput> = {}): MarathonInput =>
  ({
    id: 1,
    domain,
    setupCompleted: true,
    mode: 'marathon',
    startDate: '2026-05-21T10:00:00.000Z',
    endDate: '2026-05-21T18:00:00.000Z',
    ...overrides,
  }) as MarathonInput

const makeTopic = (overrides: Partial<Topic> = {}): Topic =>
  ({
    id: 1,
    orderIndex: 0,
    visibility: 'active',
    scheduledStart: '2026-05-21T10:00:00.000Z',
    scheduledEnd: '2026-05-21T18:00:00.000Z',
    ...overrides,
  }) as Topic

const runEnsureOpen = (
  input: Parameters<typeof ensureMarathonIsOpenForUploads>[0],
) => Effect.runSyncExit(ensureMarathonIsOpenForUploads(input))

describe('upload initializer utils', () => {
  describe('ensureMarathonIsOpenForUploads', () => {
    it('rejects when marathon setup is incomplete', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({ setupCompleted: false }),
        now,
      })

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.squash(exit.cause)
        expect(error).toBeInstanceOf(BadRequestError)
      }
    })

    it('rejects marathon mode when upload window is not configured', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({ startDate: null, endDate: null }),
        now,
      })

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('rejects marathon mode when uploads are closed', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({
          startDate: '2026-05-21T13:00:00.000Z',
          endDate: '2026-05-21T18:00:00.000Z',
        }),
        now,
      })

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('allows marathon mode inside the upload window', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon(),
        now,
      })

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('rejects by-camera mode when no active topic exists', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({
          mode: 'by-camera',
          topics: [makeTopic({ visibility: 'hidden' })],
        }),
        now,
      })

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('rejects by-camera mode before topic scheduled start', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({
          mode: 'by-camera',
          topics: [
            makeTopic({
              scheduledStart: '2026-05-21T13:00:00.000Z',
            }),
          ],
        }),
        now,
      })

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('rejects by-camera mode after topic scheduled end', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({
          mode: 'by-camera',
          topics: [
            makeTopic({
              scheduledEnd: '2026-05-21T11:00:00.000Z',
            }),
          ],
        }),
        now,
      })

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('allows by-camera mode during an open topic window', () => {
      const exit = runEnsureOpen({
        domain,
        marathon: makeMarathon({
          mode: 'by-camera',
          topics: [makeTopic()],
        }),
        now,
      })

      expect(Exit.isSuccess(exit)).toBe(true)
    })
  })

  describe('createRandomReference', () => {
    it('returns a four-digit zero-padded string', () => {
      const reference = createRandomReference()
      expect(reference).toMatch(/^\d{4}$/)
    })
  })

  describe('createUploadSessionId', () => {
    it('returns a UUID-shaped string', () => {
      const sessionId = createUploadSessionId()
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })
  })
})

describe('BadRequestError message checks', () => {
  it('includes domain in setup incomplete message', () => {
    const exit = runEnsureOpen({
      domain,
      marathon: makeMarathon({ setupCompleted: false }),
      now,
    })

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(BadRequestError)
      if (error instanceof BadRequestError) {
        expect(error.message).toContain(domain)
      }
    }
  })
})
