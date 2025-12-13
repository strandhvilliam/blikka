import { Config, Data, Effect, Layer } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import * as schema from "./schema"

export class DbConnectionError extends Data.TaggedError("DrizzleConnectionError")<{
  message?: string
  cause?: unknown
}> {}

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
}).pipe(
  Layer.mapError(
    (error) => new DbConnectionError({ cause: error, message: "Failed to connect to database" })
  )
)

export class DrizzleClient extends Effect.Service<DrizzleClient>()("@blikka/db/drizzle-client", {
  dependencies: [PgLive],
  effect: Effect.gen(function* () {
    const db = yield* PgDrizzle.make<typeof schema>({
      schema,
    })
    return db
  }),
}) {}
