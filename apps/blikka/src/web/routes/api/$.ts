import { createFileRoute } from "@tanstack/react-router";
import { env } from "../../env.ts";

// Everything under /api goes to the Api worker, so auth cookies stay first-party on this origin.
export const Route = createFileRoute("/api/$")({
  server: { handlers: { ANY: ({ request }) => env.API.fetch(request) } },
});
