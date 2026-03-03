import { formatDomainPathname } from "@/lib/utils"

export function getJuryEntryPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}`, domain, "live")
}

export function getJuryViewerPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}/viewer`, domain, "live")
}

export function getJuryCompletedPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}/completed`, domain, "live")
}

export function getJuryUnavailablePath(
  domain: string,
  token: string,
  reason: "expired" | "unsupported-mode" | "inactive",
) {
  return formatDomainPathname(`/live/jury/${token}/unavailable?reason=${reason}`, domain, "live")
}
