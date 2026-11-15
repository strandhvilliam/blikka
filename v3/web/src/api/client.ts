import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import createClient from "openapi-fetch";
import type { components, paths } from "@/api.gen.ts";
import { env } from "@/lib/env.ts";
import { meta } from "@/lib/meta.ts";

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

// A response the Api refused. Carries the status so a page can word a 409 differently from a 500,
// and the error's _tag for when one status has several causes.
export class ApiError extends Error {
  readonly status: number;
  readonly tag: string | undefined;
  constructor(response: Response, body?: ErrorBody) {
    super(`The Api responded ${response.status} to ${response.url}`);
    this.status = response.status;
    this.tag = body?._tag;
  }
}

// Every error the Api can answer with, by its _tag (the Schema.TaggedError classes on the server).
type ErrorTag = Extract<components["schemas"][keyof components["schemas"]], { _tag: string }>["_tag"];

// Branch on this rather than the status: one status can have several causes (a 400 is also a malformed request).
export const isApiError = (error: unknown, tag: ErrorTag): error is ApiError =>
  error instanceof ApiError && error.tag === tag;

// The response's data, or an ApiError. Checks `ok`, not `data`, since a 204 has no body.
export async function unwrap<T>(result: Result<T> | Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await result;

  if (!response.ok) {
    throw new ApiError(response, error);
  }

  // SAFETY: the response is ok, so openapi-fetch has set data to the endpoint's success body.
  return data as T;
}

// Every error body the Api sends is a tagged error (see the spec's error schemas).
type ErrorBody = { _tag?: string };

type Result<T> = { data?: T; error?: ErrorBody; response: Response };
