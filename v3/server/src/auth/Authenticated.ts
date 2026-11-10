import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import type * as HttpRouter from "effect/http/HttpRouter";
import type { Auth } from "./Auth.ts";
import { CurrentUser } from "./CurrentUser.ts";

// Endpoints behind it get the caller as CurrentUser; without a session the request is a 401.
// Only the definition, so the contract can name it without pulling in Better Auth. AuthenticatedLive
// in Auth.ts implements it.
export class Authenticated extends HttpApiMiddleware.Service<
  Authenticated,
  // Auth is built per request (api.ts), like the handlers' Db. A plain `requires: Auth` would ask for
  // it when the layer is built, so it carries the router's per-request marker, as handler requirements do.
  { provides: CurrentUser; requires: HttpRouter.Request<"Requires", Auth> }
>()("blikka/auth/Authenticated", { error: HttpApiError.UnauthorizedNoContent }) {}
