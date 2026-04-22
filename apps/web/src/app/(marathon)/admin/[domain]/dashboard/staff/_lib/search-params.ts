import { createLoader, parseAsString } from "nuqs/server"

export const staffSearchParams = {
  access: parseAsString,
}

export const loadStaffSearchParams = createLoader(staffSearchParams)
