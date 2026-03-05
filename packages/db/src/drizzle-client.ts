import { Effect, Layer, ServiceMap } from "effect";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { DbError } from "./utils";
import * as schema from "./schema";
import * as relations from "./relations";

export class DrizzleClient extends ServiceMap.Service<DrizzleClient>()(
  "@blikka/db/db",
  {
    make: Effect.gen(function* () {
      const sql = neon(process.env.DATABASE_URL!);
      const client = drizzle(sql, { schema: { ...schema, ...relations } });

      const use = <T>(
        fn: (db: typeof client) => Promise<T>,
      ): Effect.Effect<T, DbError, never> =>
        Effect.tryPromise({
          try: () => fn(client),
          catch: (e) =>
            new DbError({
              message:
                e instanceof Error ? e.message : "Unknown database error",
              cause: e,
            }),
        });

      return { client, use } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
