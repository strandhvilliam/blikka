import { Effect, Layer, ServiceMap } from "effect";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { DbError } from "./utils";
import * as schema from "./schema";
import * as relations from "./relations";

type DatabaseProvider = "neon" | "planetscale";

const databaseSchema = { ...schema, ...relations };

const getDatabaseProvider = (): DatabaseProvider => {
  const provider = process.env.DATABASE_PROVIDER?.trim() || "neon";

  if (provider === "neon" || provider === "planetscale") {
    return provider;
  }

  throw new Error(
    `Invalid DATABASE_PROVIDER "${provider}". Expected "neon" or "planetscale".`,
  );
};

const createDrizzleClient = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (getDatabaseProvider() === "planetscale") {
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema: databaseSchema });
};

export class DrizzleClient extends ServiceMap.Service<DrizzleClient>()(
  "@blikka/db/db",
  {
    make: Effect.gen(function* () {
      const client = createDrizzleClient();

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
