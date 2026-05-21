import { Cause, Effect, Exit, Option } from 'effect'
import type { VotingRound, VotingSession } from '@blikka/db'
import { describe, expect, it } from 'vitest'

import { BadRequestError, failNotFoundIfNone, NotFoundError } from './errors'

const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect)

describe('NotFoundError', () => {
  it('builds a message without identifier details', () => {
    expect(new NotFoundError({ resource: 'Marathon' }).message).toBe('Marathon not found')
  })

  it('builds a message with identifier details', () => {
    expect(
      new NotFoundError({ resource: 'Marathon', identifier: { domain: 'demo', id: 1 } }).message,
    ).toBe('Marathon not found (domain=demo, id=1)')
  })
})

describe('failNotFoundIfNone', () => {
  it('returns the value when the option is Some', () => {
    const exit = runEffect(
      Effect.succeed(Option.some('value')).pipe(failNotFoundIfNone('Resource', { id: 1 })),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe('value')
    }
  })

  it('fails with NotFoundError when the option is None', () => {
    const exit = runEffect(
      Effect.succeed(Option.none()).pipe(failNotFoundIfNone('Marathon', { domain: 'demo' })),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(NotFoundError)
      if (error instanceof NotFoundError) {
        expect(error.resource).toBe('Marathon')
        expect(error.identifier).toEqual({ domain: 'demo' })
      }
    }
  })
})
