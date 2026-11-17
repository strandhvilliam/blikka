import * as Cloudflare from "@alchemy.run/cloudflare";
import { TransactionRollbackError } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Pool } from "pg";
import * as model from "./model.ts";

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
      port: 5433,
      database: "blikka",
      user: "postgres",
      password: Redacted.make("postgres"),
      sslmode: "disable",
    },
  });
});

export class Db extends Context.Service<Db, NodePgDatabase<typeof model>>()("blikka/db/Db") {}

export type Tx = Parameters<Parameters<Db["Service"]["transaction"]>[0]>[0];

export const transaction = <A, E, R>(db: Db["Service"], body: (tx: Tx) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const context = yield* Effect.context<R>();

    const exit = yield* Effect.promise(async (): Promise<Exit.Exit<A, E>> => {
      let failure: Exit.Exit<A, E> | undefined;

      try {
        return await db.transaction(async (tx) => {
          const exit = await Effect.runPromiseExitWith(context)(body(tx));

          if (Exit.isFailure(exit)) {
            failure = exit;
            tx.rollback();
          }

          return exit;
        });
      } catch (error) {
        if (failure && error instanceof TransactionRollbackError) {
          return failure;
        }

        throw error;
      }
    });

    return yield* exit;
  });

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
