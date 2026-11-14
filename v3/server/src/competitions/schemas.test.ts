import { expect, test } from "bun:test";
import { slugOf } from "./schemas.ts";

test("a slug is the name in lowercase ASCII, words joined by single dashes", () => {
  expect(slugOf("Malmö Fotomaraton 2026!")).toBe("malmo-fotomaraton-2026");
  expect(slugOf("  Åre -- Photo Walk  ")).toBe("are-photo-walk");
});

test("a slug is at most 60 characters and never ends in a dash", () => {
  expect(slugOf(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
  expect(slugOf("a".repeat(100))).toBe("a".repeat(60));
});

test("a name with nothing sluggable falls back to 'event'", () => {
  expect(slugOf("写真")).toBe("event");
  expect(slugOf("!!!")).toBe("event");
});
