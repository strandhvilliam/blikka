import { drizzle } from "drizzle-orm/node-postgres";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Pool } from "pg";
import type { User } from "../contract.ts";
import { PermissionsService } from "../permissions/service.ts";
import { Db } from "./Db.ts";
import * as model from "./model.ts";

// Tests against the local Postgres (`bun run up`), each inside a transaction that is rolled back.
const pool = new Pool({
  connectionString: "postgres://postgres:postgres@localhost:5433/blikka",
  max: 1,
  allowExitOnIdle: true,
});
const db = drizzle(pool, { schema: model, casing: "snake_case" });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const rolledBack = (body: (tx: Tx) => Promise<void>) =>
  db
    .transaction(async (tx) => {
      await body(tx);
      tx.rollback();
    })
    .catch((error) => {
      if (error?.constructor?.name !== "TransactionRollbackError") throw error;
    });

// Runs a domain service against the transaction, the way api.ts provides it per request.
export const runner = <I, S>(
  tx: Tx,
  service: Context.Service<I, S>,
  layer: Layer.Layer<I, never, Db | PermissionsService>,
) => {
  const provided = layer.pipe(
    Layer.provide(PermissionsService.layer),
    Layer.provide(Layer.succeed(Db)(tx as unknown as Db["Service"])),
  );
  const run = <A, E>(f: (s: S) => Effect.Effect<A, E>) =>
    Effect.runPromise(Effect.flatMap(service, f).pipe(Effect.provide(provided)));
  const fails = <A, E extends { _tag: string }>(f: (s: S) => Effect.Effect<A, E>) =>
    run((s) => Effect.flip(f(s))).then((error) => error._tag);
  return { run, fails };
};

export const createUser = async (tx: Tx, name: string, emailVerified = true): Promise<User> => {
  const email = `${name}-${crypto.randomUUID()}@blikka.test`;
  const [row] = await tx.insert(model.user).values({ name, email, emailVerified }).returning();
  return { id: row!.id, email, name };
};

export const createOrganization = async (tx: Tx, owner: User, name = "Photo Club") => {
  const [organization] = await tx.insert(model.organizations).values({ name }).returning();
  await tx.insert(model.organizationMembers).values({ organizationId: organization!.id, userId: owner.id, role: "owner" });
  return organization!.id;
};
