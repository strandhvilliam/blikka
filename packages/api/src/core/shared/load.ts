import { Effect, Option } from 'effect'
import type { MarathonsRepository } from '@blikka/db'

type MarathonsRepositoryService = MarathonsRepository['Service']

import { BadRequestError, failNotFoundIfNone } from '../errors'

export const makeMarathonLoad = (marathonsRepository: MarathonsRepositoryService) => {
  const getMarathonByDomainOrBadRequest = Effect.fn(
    'Shared.getMarathonByDomainOrBadRequest',
  )(function* (domain: string) {
    return yield* marathonsRepository
      .getMarathonByDomainWithOptions({ domain })
      .pipe(
        Effect.andThen(
          Option.match({
            onSome: (marathon) => Effect.succeed(marathon),
            onNone: () =>
              Effect.fail(
                new BadRequestError({
                  message: `[${domain}] Marathon not found`,
                }),
              ),
          }),
        ),
      )
  })

  const getMarathonByDomainOrNotFound = Effect.fn('Shared.getMarathonByDomainOrNotFound')(
    function* (domain: string) {
      return yield* marathonsRepository
        .getMarathonByDomainWithOptions({ domain })
        .pipe(failNotFoundIfNone('Marathon', { domain }))
    },
  )

  return {
    getMarathonByDomainOrBadRequest,
    getMarathonByDomainOrNotFound,
  }
}
