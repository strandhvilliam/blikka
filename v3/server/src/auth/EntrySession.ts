import * as Context from "effect/Context";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import type * as HttpRouter from "effect/http/HttpRouter";
import type { User } from "../contract.ts";
import type { Auth } from "./Auth.ts";

export const GUEST_TOKEN_PREFIX = "blikka_pgt_";

export class EntryCaller extends Context.Service<EntryCaller, { user: User | null; guestToken: string | null }>()(
  "blikka/auth/EntryCaller",
) {}

export class EntrySession extends HttpApiMiddleware.Service<
  EntrySession,
  { provides: EntryCaller; requires: HttpRouter.Request<"Requires", Auth> }
>()("blikka/auth/EntrySession", {
  error: [HttpApiError.ForbiddenNoContent],
}) {}
