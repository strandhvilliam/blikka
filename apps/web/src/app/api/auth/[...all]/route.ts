import { Auth } from "@/lib/auth/server"
import { serverRuntime } from "@/lib/server-runtime"
import { NextRequest } from "next/server"

async function handleAuthRequest(req: NextRequest) {
  try {
    const auth = await serverRuntime.runPromise(Auth)
    return auth.handler(req)
  } catch {
    return new Response("Internal Server Error", { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleAuthRequest(req)
}

export async function POST(req: NextRequest) {
  return handleAuthRequest(req)
}
