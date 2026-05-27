/** Latest contact-sheets sponsor row; matches admin sponsors page selection. */
export function resolveContactSheetsSponsor<T extends { type: string; createdAt: string }>(
  sponsors: T[] | undefined,
): T | undefined {
  if (!sponsors?.length) return undefined

  return sponsors
    .filter((s) => s.type === 'contact-sheets')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .at(-1)
}
