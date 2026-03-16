import { describe, expect, it } from "vitest"
import { TRPCError } from "@trpc/server"

import { assertMatchingInputDomain, parseDomainFromInput } from "./domain-input-middleware"

describe("domain input middleware helpers", () => {
  it("extracts the domain from object input", () => {
    expect(parseDomainFromInput({ domain: "demo" })).toBe("demo")
    expect(parseDomainFromInput({})).toBeNull()
    expect(parseDomainFromInput(null)).toBeNull()
  })

  it("allows matching domains", () => {
    expect(() => assertMatchingInputDomain("demo", { domain: "demo" })).not.toThrow()
  })

  it("rejects mismatched domains", () => {
    expect(() => assertMatchingInputDomain("demo", { domain: "other" })).toThrow(TRPCError)
    expect(() => assertMatchingInputDomain("demo", { domain: "other" })).toThrow(
      "Input domain does not match authorized domain",
    )
  })

  it("rejects inputs without a domain", () => {
    expect(() => assertMatchingInputDomain("demo", {})).toThrow("Domain input is required")
  })
})
