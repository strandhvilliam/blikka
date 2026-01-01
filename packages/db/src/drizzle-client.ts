import { Config, Schema, Effect, Layer, Duration } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import * as schema from "./schema"

export class DbConnectionError extends Schema.TaggedError<DbConnectionError>()(
  "DrizzleConnectionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
  // Serverless/transaction pooler optimizations
  prepare: Config.boolean("false").pipe(Config.withDefault(false)),
  maxConnections: Config.integer("DB_POOL_MAX").pipe(Config.withDefault(10)),
  idleTimeout: Config.duration("DB_IDLE_TIMEOUT").pipe(Config.withDefault(Duration.seconds(5))),
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
