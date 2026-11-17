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

export const fromWallClock = (wallClock: string, timeZone: string): Date => {
  const asUtc = new Date(`${wallClock}Z`).getTime();
  const offsetAt = (t: number) => new Date(`${toWallClock(new Date(t), timeZone)}Z`).getTime() - t;

  return new Date(asUtc - offsetAt(asUtc - offsetAt(asUtc)));
};

export const formatIn = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);

const formatDay = (date: Date | string, timeZone: string): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium" }).format(new Date(date));

export const formatWindow = (opens: Date | string | null, closes: Date | string | null, timeZone: string): string => {
  if (!opens && !closes) {
    return "No date yet";
  }

  if (!closes) {
    return `From ${formatDay(opens!, timeZone)}`;
  }

  if (!opens) {
    return `Until ${formatDay(closes, timeZone)}`;
  }

  const from = formatDay(opens, timeZone);
  const to = formatDay(closes, timeZone);

  if (from === to) {
    return to;
  }

  return `${from.slice(-4) === to.slice(-4) ? from.slice(0, -5) : from} → ${to}`;
};

export const timeZones = (current: string): string[] => [...new Set([current, ...Intl.supportedValuesOf("timeZone")])];
