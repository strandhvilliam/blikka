import { Config, Schema, Effect, Layer, Duration, ServiceMap, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import * as schema from "./schema"
import { relations } from "./relations"
import { ConfigError } from "effect/Config"
import { types } from 'pg'


export class DbConnectionError extends Schema.TaggedErrorClass<DbConnectionError>()(
  "DrizzleConnectionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

const PgLive = PgClient.layer({
  url: Redacted.make(process.env.DATABASE_URL!),
  // Serverless/transaction pooler optimizations
  maxConnections: 10,
  idleTimeout: Duration.seconds(5),
  types: {
    getTypeParser: (typeId, format) => {
      // Return raw values for date/time types to let Drizzle handle parsing
      if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
        return (val: any) => val
      }
      return types.getTypeParser(typeId, format)
    },
  },
})

// Create the DB effect with default services
const dbEffect = PgDrizzle.make({ relations }).pipe(
  Effect.provide(PgDrizzle.DefaultServices)
)
// Define a DB service tag for dependency injection
// class DB extends Context.Tag('DB')<DB, Effect.Effect.Success<typeof dbEffect>>() {}
export class DrizzleClient extends ServiceMap.Service<DrizzleClient>()("@blikka/db/db", {
  make: Effect.gen(function* () {
    return yield* dbEffect
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(PgLive)
  )
}





// export class DrizzleClient extends ServiceMap.Service<DrizzleClient>()("@blikka/db/drizzle-client", {
//   make: Effect.gen(function* () {
//     const db = yield* PgDrizzle.make<typeof schema>({
//       schema,
//       relations,
//     })
//     return db
//   }),
// }) {
//   static readonly layer = Layer.effect(this, this.make).pipe(
//     Layer.provide(PgLive)
//   )
// }
