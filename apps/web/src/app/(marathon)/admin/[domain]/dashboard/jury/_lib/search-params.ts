import { createLoader, parseAsInteger, parseAsStringLiteral } from 'nuqs/server'

export const juryTabs = ['results', 'jurors'] as const
export type JuryTab = (typeof juryTabs)[number]

export const jurySearchParams = {
  invitation: parseAsInteger,
  tab: parseAsStringLiteral(juryTabs),
}

export const loadJurySearchParams = createLoader(jurySearchParams)

/** A link straight to an invitation opens on that juror; otherwise the jury's verdicts lead. */
export function resolveJuryTab({
  tab,
  invitation,
}: {
  tab: JuryTab | null
  invitation: number | null
}): JuryTab {
  if (tab) return tab
  return invitation == null ? 'results' : 'jurors'
}
