import { TRPCError } from "@trpc/server"

export function parseDomainFromInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null
  }

  const domain = Reflect.get(input, "domain")
  return typeof domain === "string" ? domain : null
}

export function assertMatchingInputDomain(authorizedDomain: string | null, input: unknown) {
  const inputDomain = parseDomainFromInput(input)

  if (!authorizedDomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Authorized domain is required",
    })
  }

  if (!inputDomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Domain input is required",
    })
  }

  if (authorizedDomain !== inputDomain) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Input domain does not match authorized domain",
    })
  }
}
