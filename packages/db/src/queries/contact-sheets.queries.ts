import type { NewContactSheet } from "../types";
import { DrizzleClient } from "../drizzle-client";
import { Effect, Layer, ServiceMap } from "effect";
import { contactSheets } from "../schema";
import { DbError } from "../utils";

export class ContactSheetsQueries extends ServiceMap.Service<ContactSheetsQueries>()(
  "@blikka/db/contact-sheets-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;

      const save = Effect.fn("ContactSheetsQueries.save")(function* ({
        data,
      }: {
        data: NewContactSheet;
      }) {
        const [result] = yield* use((db) =>
          db.insert(contactSheets).values(data).returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to save contact sheet",
            }),
          );
        }
        return result;
      });

      return {
        save,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
