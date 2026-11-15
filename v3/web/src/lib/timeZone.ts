// "2026-12-01T09:00", the format a datetime-local input takes.
export const toWallClock = (date: Date, timeZone: string): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

// Measures the offset twice, since the first guess can land on the other side of a DST change.
export const fromWallClock = (wallClock: string, timeZone: string): Date => {
  const asUtc = new Date(`${wallClock}Z`).getTime();
  const offsetAt = (t: number) => new Date(`${toWallClock(new Date(t), timeZone)}Z`).getTime() - t;
  return new Date(asUtc - offsetAt(asUtc - offsetAt(asUtc)));
};

// A fixed locale, so the server and browser render the same.
export const formatIn = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);

// `current` stays even if the list leaves it out (e.g. an alias).
export const timeZones = (current: string): string[] => [
  ...new Set([current, ...Intl.supportedValuesOf("timeZone")]),
];
