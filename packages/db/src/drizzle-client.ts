import { Context, Effect, Layer } from 'effect'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { DbError } from './utils'
import * as schema from './schema'
import * as relations from './relations'

export type DatabaseProvider = 'neon' | 'planetscale'

const databaseSchema = { ...schema, ...relations }

interface DrizzleClientConfig {
  readonly databaseUrl: string
  readonly provider: DatabaseProvider
}

const parseDatabaseProvider = Effect.fnUntraced(function* (value: string | undefined) {
  const provider = value?.trim() || 'neon'

  if (provider === 'neon' || provider === 'planetscale') {
    return provider
  }

  return yield* new DbError({
    message: `Invalid DATABASE_PROVIDER "${provider}". Expected "neon" or "planetscale".`,
  })
})

const makeConfig = Effect.fnUntraced(function* () {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    return yield* new DbError({
      message: 'DATABASE_URL is required.',
    })
  }

  const provider = yield* parseDatabaseProvider(process.env.DATABASE_PROVIDER)

  return {
    databaseUrl,
    provider,
  } satisfies DrizzleClientConfig
})

const createDrizzleDatabase = ({ databaseUrl, provider }: DrizzleClientConfig) => {
  if (provider === 'planetscale') {
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`
  }

  const sql = neon(databaseUrl)
  return drizzle(sql, { schema: databaseSchema })
}

export type DrizzleDatabase = ReturnType<typeof createDrizzleDatabase>

const makeDrizzleClient = Effect.gen(function* () {
  const config = yield* makeConfig()
  const client = createDrizzleDatabase(config)

  const use = <T>(fn: (db: DrizzleDatabase) => Promise<T>): Effect.Effect<T, DbError> =>
    Effect.tryPromise({
      try: () => fn(client),
      catch: (cause) =>
        new DbError({
          message: cause instanceof Error ? cause.message : 'Unknown database error',
          cause,
        }),
    })

  return DrizzleClient.of({
    client,
    use,
  })
})

export class DrizzleClient extends Context.Service<
  DrizzleClient,
  {
    readonly client: DrizzleDatabase
    readonly use: <T>(fn: (db: DrizzleDatabase) => Promise<T>) => Effect.Effect<T, DbError>
  }
>()('@blikka/db/DrizzleClient') {
  static readonly layerNoDeps = Layer.effect(this, makeDrizzleClient)
  static readonly layer = this.layerNoDeps
}
