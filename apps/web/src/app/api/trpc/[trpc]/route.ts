import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@blikka/api/trpc";
import { serverRuntime } from "@/lib/server-runtime";
import { getTRPCCorsHeaders } from "../cors";

const setCorsHeaders = (res: Response, origin: string | null) => {
  const headers = getTRPCCorsHeaders(origin);

  if (!origin) {
    return;
  }

  res.headers.append("Vary", "Origin");

  if (!headers) {
    return;
  }

  headers.forEach((value, key) => {
    if (key.toLowerCase() === "vary") {
      res.headers.set(key, value);
      return;
    }

    res.headers.set(key, value);
  });
};

export const OPTIONS = (req: NextRequest) => {
  const origin = req.headers.get("origin");
  const headers = getTRPCCorsHeaders(origin);

  if (origin && !headers) {
    const response = new Response(null, {
      status: 403,
    });
    setCorsHeaders(response, origin);
    return response;
  }

  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response, origin);
  return response;
};

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () =>
      createTRPCContext({
        runtime: serverRuntime,
        headers: req.headers,
      }),
    // onError({ error, path }) {
    //   console.log("ERROR CODE", error.code)
    // },
  });

  setCorsHeaders(response, req.headers.get("origin"));
  return response;
};

export { handler as GET, handler as POST };
