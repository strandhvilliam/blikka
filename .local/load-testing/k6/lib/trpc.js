import http from "k6/http"
import { check, fail } from "k6"

function buildHeaders(config, extraHeaders = {}) {
  return {
    "Content-Type": "application/json",
    "x-marathon-domain": config.headerDomain,
    "x-trpc-source": "blikka-k6-load-test",
    ...extraHeaders,
  }
}

function unwrapTrpcData(payload) {
  if (!payload || typeof payload !== "object") return payload
  const result = payload.result
  if (!result || typeof result !== "object") return payload

  const data = result.data
  if (data && typeof data === "object" && "json" in data) {
    return data.json
  }

  return data
}

function getTrpcErrorMessage(payload, fallbackMessage) {
  if (!payload || typeof payload !== "object") return fallbackMessage

  if (payload.error?.json?.message) return payload.error.json.message
  if (payload.error?.message) return payload.error.message
  if (payload.message) return payload.message

  return fallbackMessage
}

function parseJsonResponse(response, fallbackMessage) {
  const payload = response.json()

  if (response.status >= 400 || payload?.error) {
    fail(getTrpcErrorMessage(payload, fallbackMessage))
  }

  return unwrapTrpcData(payload)
}

export function trpcMutation(config, procedure, input, tags = {}) {
  const url = `${config.targetBaseUrl}/api/trpc/${procedure}`
  const response = http.post(url, JSON.stringify(input), {
    headers: buildHeaders(config),
    tags: {
      protocol: "trpc",
      trpc_type: "mutation",
      procedure,
      ...tags,
    },
    timeout: "120s",
  })

  check(response, {
    [`${procedure} returned 2xx`]: (res) => res.status >= 200 && res.status < 300,
  })

  return {
    response,
    data: parseJsonResponse(response, `${procedure} failed`),
  }
}

export function trpcQuery(config, procedure, input, tags = {}) {
  const encodedInput = encodeURIComponent(JSON.stringify(input))
  const url = `${config.targetBaseUrl}/api/trpc/${procedure}?input=${encodedInput}`
  const response = http.get(url, {
    headers: buildHeaders(config),
    tags: {
      protocol: "trpc",
      trpc_type: "query",
      procedure,
      ...tags,
    },
    timeout: "120s",
  })

  check(response, {
    [`${procedure} returned 2xx`]: (res) => res.status >= 200 && res.status < 300,
  })

  return {
    response,
    data: parseJsonResponse(response, `${procedure} failed`),
  }
}

export function putPresignedUpload(config, presignedUrl, binaryFixture, contentType, tags = {}) {
  const response = http.put(presignedUrl, binaryFixture, {
    headers: {
      "Content-Type": contentType,
    },
    tags: {
      protocol: "s3",
      step: "upload_put",
      ...tags,
    },
    timeout: "180s",
  })

  return response
}
