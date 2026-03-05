import { Console, Effect, Layer, ServiceMap } from "effect"
import { Pool, types } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { relations } from "./relations"
import { DbError } from "./utils"

export class DrizzleClient extends ServiceMap.Service<DrizzleClient>()("@blikka/db/db", {
  make: Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => new Pool({
        connectionString: process.env.DATABASE_URL!,
        max: parseInt(process.env.DB_POOL_MAX ?? "3", 10),
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 10_000,
        allowExitOnIdle: true,
        types: {
          getTypeParser: (typeId, format) => {
            if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
              return (val: any) => val
            }
            return types.getTypeParser(typeId, format)
          },
        },
      })),
      (pool) =>
        Effect.promise(() => pool.end()).pipe(
          Effect.tap(() => Console.log("DrizzleClient pool closed")),
        ),
    )

    const client = drizzle({ client: pool, relations })

    const use = <T>(
      fn: (db: typeof client) => Promise<T>,
    ): Effect.Effect<T, DbError, never> =>
      Effect.tryPromise({
        try: () => fn(client),
        catch: (e) => new DbError({
          message: e instanceof Error ? e.message : "Unknown database error",
          cause: e,
        }),
      })

    return { client, use } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
