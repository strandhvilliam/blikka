import { addDays } from 'date-fns'

export function getEndOfDayExpiryIso(daysFromNow: number): string {
  const expiresAt = addDays(new Date(), daysFromNow)
  expiresAt.setHours(23, 59, 59, 999)
  return expiresAt.toISOString()
}
