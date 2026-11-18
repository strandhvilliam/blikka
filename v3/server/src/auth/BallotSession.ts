import * as Context from "effect/Context";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import type * as HttpRouter from "effect/http/HttpRouter";
import type { User } from "../contract.ts";
import type { Auth } from "./Auth.ts";

export const JUROR_TOKEN_PREFIX = "blikka_jvt_";

export class BallotCaller extends Context.Service<
  BallotCaller,
  { user: User | null; guestToken: string | null; jurorToken: string | null }
>()("blikka/auth/BallotCaller") {}

export class BallotSession extends HttpApiMiddleware.Service<
  BallotSession,
  { provides: BallotCaller; requires: HttpRouter.Request<"Requires", Auth> }
>()("blikka/auth/BallotSession", {
  error: [HttpApiError.ForbiddenNoContent],
}) {}
