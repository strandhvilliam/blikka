import { Config, Schema, Effect, Layer, Duration, ServiceMap } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import * as schema from "./schema"

export class DbConnectionError extends Schema.TaggedErrorClass<DbConnectionError>()(
  "DrizzleConnectionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
  // Serverless/transaction pooler optimizations
  prepare: Config.boolean("false").pipe(Config.withDefault(false)),
  maxConnections: Config.number("DB_POOL_MAX").pipe(Config.withDefault(10)),
  idleTimeout: Config.duration("DB_IDLE_TIMEOUT").pipe(Config.withDefault(Duration.seconds(5))),
})
export class DrizzleClient extends ServiceMap.Service<DrizzleClient>()("@blikka/db/drizzle-client", {
  make: Effect.gen(function* () {
    const db = yield* PgDrizzle.make<typeof schema>({
      schema,
    })
    return db
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(PgLive)
  )
}
