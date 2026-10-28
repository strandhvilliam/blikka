import * as Axiom from "@alchemy.run/axiom";
import * as AdoptPolicy from "alchemy/AdoptPolicy";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";

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
