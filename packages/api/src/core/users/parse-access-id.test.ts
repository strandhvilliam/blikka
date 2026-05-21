import { Cause, Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'

import { BadRequestError } from '../errors'
import { parseAccessId } from './parse-access-id'

const runParseAccessId = (accessId: string) => Effect.runSyncExit(parseAccessId(accessId))

describe('parseAccessId', () => {
  it('parses active user access ids', () => {
    const exit = runParseAccessId('u:user-123')

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({ kind: 'active', userId: 'user-123' })
    }
  })

  it('parses pending invitation access ids', () => {
    const exit = runParseAccessId('p:42')

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({ kind: 'pending', pendingId: 42 })
    }
  })

  it('decodes URL-encoded access ids', () => {
    const exit = runParseAccessId(encodeURIComponent('u:user-123'))

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({ kind: 'active', userId: 'user-123' })
    }
  })

  it('rejects invalid access ids', () => {
    const exit = runParseAccessId('invalid')

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toBeInstanceOf(BadRequestError)
    }
  })
})
