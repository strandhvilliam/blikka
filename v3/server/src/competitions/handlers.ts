import * as Effect from 'effect/Effect'
import * as HttpApiBuilder from 'effect/http-api/HttpApiBuilder'
import { CurrentUser } from '../auth/CurrentUser.ts'
import { Api } from '../contract.ts'
import { CompetitionsService } from './service.ts'

// CompetitionsService is built per request (api.ts), so it's read inside each handler.
export const CompetitionsHandlers = HttpApiBuilder.group(Api, 'competitions', (handlers) =>
  handlers
    .handle('list', ({ query }) =>
      Effect.gen(function* () {
        const competitions = yield* CompetitionsService
        const user = yield* CurrentUser
        return yield* competitions.list(user, query.organization_id)
      }),
    )
    .handle('create', ({ payload }) =>
      Effect.gen(function* () {
        const competitions = yield* CompetitionsService
        const user = yield* CurrentUser
        return yield* competitions.create(user, payload.organization_id, payload.name)
      }),
    )
    .handle('get', ({ params }) =>
      Effect.gen(function* () {
        const competitions = yield* CompetitionsService
        const user = yield* CurrentUser
        return yield* competitions.get(user, params.id)
      }),
    ),
)
