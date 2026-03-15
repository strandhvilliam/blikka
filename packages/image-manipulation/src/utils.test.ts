import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { parseKey } from "./utils"

describe("parseKey", () => {
  it("parses standard submission keys", async () => {
    const parsed = await Effect.runPromise(parseKey("demo/1001/01/original.jpg"))

    expect(parsed).toEqual({
      domain: "demo",
      reference: "1001",
      orderIndex: "01",
      fileName: "original.jpg",
    })
  })

  it("parses seeded submission keys under the __seed namespace", async () => {
    const parsed = await Effect.runPromise(parseKey("demo/__seed/1001/01/original.jpg"))

    expect(parsed).toEqual({
      domain: "demo",
      reference: "1001",
      orderIndex: "01",
      fileName: "original.jpg",
    })
  })
})
