'use server'

import { sanitizeRedirectPath } from '@/lib/auth/redirect'
import { getPostLoginPathForCurrentUser } from '@/lib/auth/permissions'
import { signInWithEmailOtp } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function verifyAction(input: { email: string; otp: string; next?: string }) {
  try {
    const readonlyHeaders = await headers()

    await signInWithEmailOtp({
      email: input.email,
      otp: input.otp,
      headers: readonlyHeaders,
    })
  } catch (error) {
    console.error(error)

    return {
      data: undefined,
      error: 'Invalid verification code. Please try again.',
    }
  }

  redirect(sanitizeRedirectPath(input.next) ?? (await getPostLoginPathForCurrentUser()))
}
