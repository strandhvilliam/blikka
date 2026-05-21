import { Cause, Effect, Exit } from 'effect'
import type { Topic } from '@blikka/db'
import { describe, expect, it } from 'vitest'

import { BadRequestError, NotFoundError } from '../errors'
import {
  findActiveByCameraTopic,
  getActiveByCameraTopicOrBadRequest,
  getActiveByCameraTopicOrNotFound,
  requireByCameraMode,
  requireMarathonMode,
} from './by-camera'

const domain = 'demo'

const makeTopic = (overrides: Partial<Topic> = {}): Topic =>
  ({
    id: 1,
    orderIndex: 0,
    visibility: 'public',
    ...overrides,
  }) as Topic

const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect)

describe('findActiveByCameraTopic', () => {
  it('returns the first topic with visibility active', () => {
    const active = makeTopic({ id: 2, visibility: 'active', name: 'Active' })
    const topics = [makeTopic({ id: 1, visibility: 'public' }), active]

    expect(findActiveByCameraTopic(topics)).toBe(active)
  })

  it('returns null when no active topic exists', () => {
    expect(findActiveByCameraTopic([makeTopic({ visibility: 'public' })])).toBeNull()
  })
})

describe('requireByCameraMode', () => {
  it('succeeds when marathon is in by-camera mode', () => {
    const exit = runEffect(
      requireByCameraMode({ mode: 'by-camera', domain }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('fails with domain in message when marathon is not in by-camera mode', () => {
    const exit = runEffect(
      requireByCameraMode({ mode: 'marathon', domain }, { messagePrefix: 'Upload' }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(BadRequestError)
      if (error instanceof BadRequestError) {
        expect(error.message).toContain(domain)
        expect(error.message).toContain('Upload')
      }
    }
  })
})

describe('requireMarathonMode', () => {
  it('succeeds when marathon matches the required mode', () => {
    const exit = runEffect(
      requireMarathonMode({ mode: 'marathon', domain }, 'marathon', 'Marathon {domain} only'),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('substitutes domain into the error message', () => {
    const exit = runEffect(
      requireMarathonMode({ mode: 'by-camera', domain }, 'marathon', 'Marathon {domain} only'),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(BadRequestError)
      if (error instanceof BadRequestError) {
        expect(error.message).toBe(`Marathon ${domain} only`)
      }
    }
  })
})

describe('getActiveByCameraTopicOrBadRequest', () => {
  it('returns the active topic', () => {
    const active = makeTopic({ visibility: 'active' })
    const exit = runEffect(
      getActiveByCameraTopicOrBadRequest({ domain, topics: [active] }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(active)
    }
  })

  it('fails when no active topic exists', () => {
    const exit = runEffect(
      getActiveByCameraTopicOrBadRequest({ domain, topics: [makeTopic()] }),
    )

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

describe('getActiveByCameraTopicOrNotFound', () => {
  it('fails with NotFoundError when no active topic exists', () => {
    const exit = runEffect(
      getActiveByCameraTopicOrNotFound({ domain, topics: [] }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(NotFoundError)
    }
  })
})
