import 'server-only'

import { BetterAuthService, type Session } from '@blikka/auth'
import { headers } from 'next/headers'
import { serverRuntime } from '@/lib/server-runtime'
export { AuthConfigLayer, AuthLayer } from './layer'

export function getAuth() {
  return serverRuntime.runPromise(BetterAuthService)
}

export async function getAppSession(): Promise<Session | null> {
  const auth = await getAuth()
  return auth.api.getSession({
    headers: await headers(),
  })
}

export async function sendSignInOtp({ email, headers }: { email: string; headers: Headers }) {
  const auth = await getAuth()

  return auth.api.sendVerificationOTP({
    headers,
    body: {
      email,
      type: 'sign-in',
    },
  })
}

export async function signInWithEmailOtp({
  email,
  otp,
  headers,
}: {
  email: string
  otp: string
  headers: Headers
}) {
  const auth = await getAuth()

  await auth.api.signInEmailOTP({
    headers,
    body: {
      email,
      otp,
    },
  })

  return auth.api.getSession({ headers })
}

export { BetterAuthService as Auth }
