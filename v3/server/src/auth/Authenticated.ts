import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import type * as HttpRouter from "effect/http/HttpRouter";
import type { Auth } from "./Auth.ts";
import { CurrentUser } from "./CurrentUser.ts";

// Only the definition, so the contract doesn't pull in Better Auth. AuthenticatedLive implements it.
export class Authenticated extends HttpApiMiddleware.Service<
  Authenticated,
  // Auth is built per request (api.ts), like the handlers' Db. A plain `requires: Auth` would ask for
  // it when the layer is built, so it carries the router's per-request marker, as handler requirements do.
  { provides: CurrentUser; requires: HttpRouter.Request<"Requires", Auth> }
>()("blikka/auth/Authenticated", {
  error: [HttpApiError.UnauthorizedNoContent, HttpApiError.ForbiddenNoContent],
}) {}
