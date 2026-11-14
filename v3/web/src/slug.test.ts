import { expect, test } from "bun:test";
// Test-only: the one place the website reads server code, to catch its copy of slugOf drifting.
import { slugOf as apiSlugOf } from "../../server/src/competitions/schemas.ts";
import { slugOf } from "./slug.ts";

test("the slug preview is the slug the Api gives", () => {
  for (const name of ["Malmö Fotomaraton 2026!", "  Åre -- Photo Walk  ", `${"a".repeat(59)} b`, "写真", "ﬁne Ⅳ ½"]) {
    expect(slugOf(name)).toBe(apiSlugOf(name));
  }
});
