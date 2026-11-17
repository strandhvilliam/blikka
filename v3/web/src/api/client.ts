import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import createClient from "openapi-fetch";
import type { components, paths } from "@/api.gen.ts";
import { env } from "@/lib/env.ts";
import { meta } from "@/lib/meta.ts";

export const api = createIsomorphicFn()
  .server(() => {
    const cookie = getRequestHeader("cookie");

    return createClient<paths>({ baseUrl: env.API_URL, headers: cookie ? { cookie } : {} });
  })
  .client(() => createClient<paths>({ baseUrl: meta("api-url"), credentials: "include" }));

export class ApiError extends Error {
  readonly status: number;
  readonly tag: string | undefined;
  constructor(response: Response, body?: ErrorBody) {
    super(`The Api responded ${response.status} to ${response.url}`);
    this.status = response.status;
    this.tag = body?._tag;
  }
}

type ErrorTag = Extract<components["schemas"][keyof components["schemas"]], { _tag: string }>["_tag"];

export const isApiError = (error: unknown, tag: ErrorTag): error is ApiError =>
  error instanceof ApiError && error.tag === tag;

export async function unwrap<T>(result: Result<T> | Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await result;

  if (!response.ok) {
    throw new ApiError(response, error);
  }

  // SAFETY: the response is ok, so openapi-fetch has set data to the endpoint's success body.
  return data as T;
}

type ErrorBody = { _tag?: string };

type Result<T> = { data?: T; error?: ErrorBody; response: Response };
