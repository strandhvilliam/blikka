import { describe, expect, it } from "vitest";

import { getTRPCCorsHeaders, isAllowedTRPCOrigin } from "./cors";

describe("trpc cors", () => {
  it("allows the root origin", () => {
    expect(isAllowedTRPCOrigin("http://localhost:3002")).toBe(true);
  });

  it("allows valid subdomains of the configured root domain", () => {
    expect(isAllowedTRPCOrigin("http://demo.localhost:3002")).toBe(true);
  });

  it("rejects foreign origins", () => {
    expect(isAllowedTRPCOrigin("https://evil.example")).toBe(false);
  });

  it("returns no CORS headers when origin is missing", () => {
    expect(getTRPCCorsHeaders(null)).toBeNull();
  });

  it("returns the expected headers for allowed origins", () => {
    const headers = getTRPCCorsHeaders("http://demo.localhost:3002");

    expect(headers?.get("Access-Control-Allow-Origin")).toBe(
      "http://demo.localhost:3002",
    );
    expect(headers?.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(headers?.get("Access-Control-Allow-Methods")).toBe(
      "OPTIONS, GET, POST",
    );
    expect(headers?.get("Access-Control-Allow-Headers")).toBe(
      "content-type, x-trpc-source, x-marathon-domain, authorization",
    );
    expect(headers?.get("Vary")).toBe("Origin");
  });
});
