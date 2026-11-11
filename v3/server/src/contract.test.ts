import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import { OrganizationName } from "./contract.ts";

test("an organization name is trimmed, required and at most 100 characters", () => {
  const decode = Schema.decodeUnknownSync(OrganizationName);
  expect(decode("  Foto  ")).toBe("Foto");
  expect(() => decode("   ")).toThrow();
  expect(decode("a".repeat(100))).toBe("a".repeat(100));
  expect(() => decode("a".repeat(101))).toThrow();
});
