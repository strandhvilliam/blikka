import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { ALCHEMY_DEV } from "alchemy/Phase";
import * as AdoptPolicy from "alchemy/AdoptPolicy";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { sentryProject } from "../../sentry-project.ts";

// Datasets are shared by every stage (Axiom plan dataset limit); stages are told apart by
// service.name. Adopt so each stage can take them over, retain so destroying a stage keeps them.
const TRACES = "blikka-traces";
const LOGS = "blikka-logs";

export const Traces = Axiom.Dataset("Traces", { name: TRACES, kind: "otel:traces:v1" }).pipe(
  AdoptPolicy.adopt(),
  RemovalPolicy.retain(),
);

export const Logs = Axiom.Dataset("Logs", { name: LOGS, kind: "otel:logs:v1" }).pipe(
  AdoptPolicy.adopt(),
  RemovalPolicy.retain(),
);

export const Ingest = Effect.gen(function* () {
  return yield* Axiom.ApiToken("Ingest", {
    name: `blikka-ingest-${yield* Stage}`,
    datasetCapabilities: {
      [TRACES]: { ingest: ["create"] },
      [LOGS]: { ingest: ["create"] },
    },
  });
});

export const Telemetry = Layer.unwrap(
  Effect.gen(function* () {
    if (yield* ALCHEMY_DEV) return Layer.empty;
    return Axiom.Telemetry({ token: Ingest, traces: Traces, logs: Logs });
  }),
);

export const SentryDsn = Config.all({
  dsn: Config.option(Config.String("SENTRY_DSN")),
  dev: ALCHEMY_DEV,
}).pipe(Config.map(({ dsn, dev }) => (dev ? Option.none() : dsn)));

// Plan-time only: the bundler folds `__ALCHEMY_RUNTIME__` to true in the Worker, which drops this
// branch and keeps the source-map plugin out of the deployed bundle.
export const SentrySourceMaps = Effect.gen(function* () {
  if (!globalThis.__ALCHEMY_RUNTIME__) {
    const { dev, authToken } = yield* Config.all({
      dev: ALCHEMY_DEV,
      authToken: Config.option(Config.Redacted("SENTRY_AUTH_TOKEN")),
    });
    if (!dev && Option.isSome(authToken)) {
      const { sentryRollupPlugin } = yield* Effect.promise(() => import("@sentry/rollup-plugin"));
      const plugin = sentryRollupPlugin({
        ...sentryProject,
        authToken: Redacted.value(authToken.value),
      });
      return { input: { plugins: [plugin] } } satisfies Cloudflare.WorkerProps["build"];
    }
  }
  return undefined;
});
