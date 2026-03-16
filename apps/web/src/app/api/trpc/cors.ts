import { protocol, rootDomain } from "../../../config"

const ALLOWED_METHODS = "OPTIONS, GET, POST"
const ALLOWED_HEADERS = "content-type, x-trpc-source, x-marathon-domain, authorization"

function getRootOrigin() {
  return new URL(`${protocol}://${rootDomain}`)
}

export function isAllowedTRPCOrigin(origin: string): boolean {
  let candidate: URL

  try {
    candidate = new URL(origin)
  } catch {
    return false
  }

  const root = getRootOrigin()
  if (candidate.origin === root.origin) return true
  return (
    candidate.protocol === root.protocol &&
    candidate.port === root.port &&
    candidate.hostname.endsWith(`.${root.hostname}`)
  )
}

export function getTRPCCorsHeaders(origin: string | null): Headers | null {
  if (!origin || !isAllowedTRPCOrigin(origin)) return null

  const headers = new Headers()
  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Access-Control-Allow-Credentials", "true")
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS)
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS)
  headers.set("Vary", "Origin")

  return headers
}
