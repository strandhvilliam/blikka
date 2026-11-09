import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import createClient from "openapi-fetch";
import type { paths } from "./api.gen.ts";
import { env } from "./env.ts";
import { meta } from "./meta.ts";

// The Api's client, typed from its OpenAPI spec (`bun run api:generate`), so no Effect code reaches
// the browser (adr/0002-website-and-api-boundary.md). Loaders run on the server for the first load
// and in the browser after that; only the credentials differ. The server forwards the visitor's
// cookie. The browser sends its own, and the server can't set `credentials` (Workers' fetch rejects it).
export const api = createIsomorphicFn()
  .server(() => {
    const cookie = getRequestHeader("cookie");
    return createClient<paths>({ baseUrl: env.API_URL, headers: cookie ? { cookie } : {} });
  })
  .client(() => createClient<paths>({ baseUrl: meta("api-url"), credentials: "include" }));
