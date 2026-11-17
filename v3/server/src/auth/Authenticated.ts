import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import type * as HttpRouter from "effect/http/HttpRouter";
import type { Auth } from "./Auth.ts";
import { CurrentUser } from "./CurrentUser.ts";

export class Authenticated extends HttpApiMiddleware.Service<
  Authenticated,
  { provides: CurrentUser; requires: HttpRouter.Request<"Requires", Auth> }
>()("blikka/auth/Authenticated", {
  error: [HttpApiError.UnauthorizedNoContent, HttpApiError.ForbiddenNoContent],
}) {}
