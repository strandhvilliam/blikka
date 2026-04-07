import { createLoader, parseAsInteger } from "nuqs/server"

export const jurySearchParams = {
  invitation: parseAsInteger,
}

export const loadJurySearchParams = createLoader(jurySearchParams)
