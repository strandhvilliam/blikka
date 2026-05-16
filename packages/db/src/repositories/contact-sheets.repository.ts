import type { NewContactSheet } from "../types"
import { DrizzleClient } from "../drizzle-client"
import { Effect, Layer, Context } from "effect"
import { contactSheets } from "../schema"
import { DbError } from "../utils"

export class ContactSheetsRepository extends Context.Service<
  ContactSheetsRepository,
  {
  /** Insert a generated contact sheet row. */
  readonly save: (params: {
    data: NewContactSheet
  }) => Effect.Effect<NewContactSheet, DbError>
}
>()("@blikka/db/contact-sheets-repository") {}

const makeContactSheetsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const save: ContactSheetsRepository["Service"]["save"] = Effect.fn(
    "ContactSheetsRepository.save",
  )(function* ({ data }) {
    const [result] = yield* use((db) => db.insert(contactSheets).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to save contact sheet",
        }),
      )
    }
    return result
  })

  return ContactSheetsRepository.of({
    save,
  })
})

export const ContactSheetsRepositoryLayerNoDeps = Layer.effect(
  ContactSheetsRepository,
  makeContactSheetsRepository,
)

export const ContactSheetsRepositoryLayer = ContactSheetsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
