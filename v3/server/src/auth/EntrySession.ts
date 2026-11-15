import * as Context from "effect/Context";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import type * as HttpRouter from "effect/http/HttpRouter";
import type { User } from "../contract.ts";
import type { Auth } from "./Auth.ts";

// Guest tokens carry this prefix, so they share `Authorization: Bearer` with Better Auth's session tokens (adr/0004).
export const GUEST_TOKEN_PREFIX = "blikka_pgt_";

// Who is calling the entry routes: the session's user, a guest token, both, or neither.
export class EntryCaller extends Context.Service<EntryCaller, { user: User | null; guestToken: string | null }>()(
  "blikka/auth/EntryCaller",
) {}

// For the entry routes, which guests use too (adr/0004). Only the definition, like Authenticated.
export class EntrySession extends HttpApiMiddleware.Service<
  EntrySession,
  { provides: EntryCaller; requires: HttpRouter.Request<"Requires", Auth> }
>()("blikka/auth/EntrySession", {
  error: [HttpApiError.ForbiddenNoContent],
}) {}
