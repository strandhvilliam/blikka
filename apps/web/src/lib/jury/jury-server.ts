import 'server-only'

import { notFound, redirect } from 'next/navigation'
import { fetchServerQuery, trpc } from '@/lib/trpc/server'
import { getJuryUnavailablePath } from './jury-utils'

export async function getJuryInvitationForRoute({
  domain,
  token,
}: {
  domain: string
  token: string
}) {
  try {
    return await fetchServerQuery(
      trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // TODO: Use a better way than checking the error message for different routing.
    if (message.includes('Invitation expired')) {
      redirect(getJuryUnavailablePath(domain, token, 'expired'))
    }

    if (message.includes('Unsupported marathon mode')) {
      redirect(getJuryUnavailablePath(domain, token, 'unsupported-mode'))
    }

    if (message.includes('Invitation link revoked')) {
      redirect(getJuryUnavailablePath(domain, token, 'revoked'))
    }

    notFound()
  }
}
