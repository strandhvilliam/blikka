/** Cursor pagination for `getJurySubmissionsFromToken` — shared by server prefetch and client hook. */
export function getJurySubmissionsNextPageParam(lastPage: {
  nextCursor?: string | null
} | null | undefined) {
  return lastPage?.nextCursor ?? undefined
}
