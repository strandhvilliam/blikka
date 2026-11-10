import * as Cloudflare from "@alchemy.run/cloudflare";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Pool } from "pg";
import * as model from "../model.ts";

// Hyperdrive in front of the Postgres in DATABASE_URL. `alchemy dev` connects to the local Postgres
// in docker-compose.yml instead, so dev never touches the database deployed stages use.
export const Database = Effect.gen(function* () {
  const url = new URL(Redacted.value(yield* Config.Redacted("DATABASE_URL")));
  return yield* Cloudflare.Hyperdrive.Connection("Database", {
    origin: {
      scheme: "postgres",
      host: url.hostname,
      port: Number(url.port || 5432),
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: Redacted.make(decodeURIComponent(url.password)),
    },
    dev: {
      scheme: "postgres",
      host: "localhost",
      port: 5433, // docker-compose.yml
      database: "blikka",
      user: "postgres",
      password: Redacted.make("postgres"),
      sslmode: "disable",
    },
  });
});

export class Db extends Context.Service<Db, NodePgDatabase<typeof model>>()("blikka/db/Db") {}

// Per request: Workers can't share sockets across requests, and Hyperdrive does the real pooling.
export const DbLive = (hyperdrive: Cloudflare.Hyperdrive.ConnectClient) =>
  Layer.effect(
    Db,
    Effect.gen(function* () {
      const url = yield* hyperdrive.connectionString;
      const pool = yield* Effect.acquireRelease(
        Effect.sync(() => new Pool({ connectionString: Redacted.value(url), max: 1 })),
        (pool) => Effect.promise(() => pool.end()),
      );
      return drizzle(pool, { schema: model, casing: "snake_case" });
    }),
  );
