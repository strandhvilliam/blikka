import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { OrganizationNotFound } from "../organizations/schemas.ts";
import { transaction, type Tx as DbTx } from "./Db.ts";
import * as model from "./model.ts";
import { asDb, rolledBack, type Tx } from "./testDb.ts";

const insertOrganization = (tx: DbTx, name: string) =>
  Effect.promise(() => tx.insert(model.organizations).values({ name }));

const named = (tx: Tx, name: string) => tx.select().from(model.organizations).where(eq(model.organizations.name, name));

test("a body that succeeds commits its writes", () =>
  rolledBack(async (tx) => {
    const name = crypto.randomUUID();
    await Effect.runPromise(transaction(asDb(tx), (t) => insertOrganization(t, name)));
    expect(await named(tx, name)).toHaveLength(1);
  }));

test("a body that fails rolls its writes back and fails with the same error", () =>
  rolledBack(async (tx) => {
    const name = crypto.randomUUID();

    const error = await Effect.runPromise(
      Effect.flip(
        transaction(asDb(tx), (t) =>
          Effect.gen(function* () {
            yield* insertOrganization(t, name);

            return yield* new OrganizationNotFound();
          }),
        ),
      ),
    );

    expect(error._tag).toBe("OrganizationNotFound");
    expect(await named(tx, name)).toHaveLength(0);
  }));
