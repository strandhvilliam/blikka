import { Effect } from 'effect'

import { BadRequestError } from '../errors'

export function parseAccessId(accessId: string): Effect.Effect<
  { kind: 'active'; userId: string } | { kind: 'pending'; pendingId: number },
  BadRequestError
> {
  return Effect.gen(function* () {
    const decodedAccessId = accessId.includes('%')
      ? (() => {
          try {
            return decodeURIComponent(accessId)
          } catch {
            return accessId
          }
        })()
      : accessId

    if (decodedAccessId.startsWith('u:')) {
      return { kind: 'active' as const, userId: decodedAccessId.slice(2) }
    }

    if (decodedAccessId.startsWith('p:')) {
      const pendingId = Number(decodedAccessId.slice(2))
      if (Number.isInteger(pendingId) && pendingId > 0) {
        return { kind: 'pending' as const, pendingId }
      }
    }

    return yield* Effect.fail(new BadRequestError({ message: `Invalid access id: ${accessId}` }))
  })
}
