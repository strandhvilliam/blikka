function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  return first || null
}

function defaultProtocol(host: string): 'http' | 'https' {
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
    ? 'http'
    : 'https'
}

export function requestOriginFromHeaders(headers: Headers): string | null {
  const host =
    firstHeaderValue(headers.get('x-forwarded-host')) ?? firstHeaderValue(headers.get('host'))

  if (!host) return null

  const forwardedProtocol = firstHeaderValue(headers.get('x-forwarded-proto'))
  const protocol =
    forwardedProtocol === 'http' || forwardedProtocol === 'https'
      ? forwardedProtocol
      : defaultProtocol(host)

  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return null
  }
}

export function resolveTrpcBaseUrl({
  browserOrigin,
  requestOrigin,
  port,
}: {
  browserOrigin: string | null
  requestOrigin: string | null
  port: string | undefined
}): string {
  return browserOrigin ?? requestOrigin ?? `http://localhost:${port ?? 3000}`
}
