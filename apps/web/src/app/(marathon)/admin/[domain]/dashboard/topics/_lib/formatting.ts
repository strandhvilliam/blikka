import { format } from "date-fns";

export const VISIBILITY_LABELS = {
  active: "Active",
  public: "Public",
  scheduled: "Scheduled",
  private: "Private",
} as const;

export function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return format(date, "MMM d, yyyy, HH:mm");
}
