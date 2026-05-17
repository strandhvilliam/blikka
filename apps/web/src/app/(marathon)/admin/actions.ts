'use server'

import { LOCALE_COOKIE_NAME } from '@/config'
import { cookies } from 'next/headers'

type FnProps = {
  locale: string
}

export async function updateLocaleAction(props: FnProps) {
  try {
    const store = await cookies()
    store.set(LOCALE_COOKIE_NAME, props.locale)
    return { data: undefined, error: null }
  } catch (error) {
    return {
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
