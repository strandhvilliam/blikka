import { format } from "date-fns"

export const VISIBILITY_LABELS = {
  active: "Active",
  public: "Public",
  scheduled: "Scheduled",
  private: "Private",
} as const

export function formatTimestamp(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return format(date, "MMM d, yyyy, HH:mm")
}

export function toDateTimeLocalValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

export function toIsoFromLocal(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
