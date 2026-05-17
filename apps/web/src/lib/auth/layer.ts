import 'server-only'

import { AuthConfig, BetterAuthServiceLayer } from '@blikka/auth'
import { Layer } from 'effect'
import { protocol } from '@/config'

const baseUrl =
  process.env.BETTER_AUTH_URL ??
  `${protocol}://${process.env.NEXT_PUBLIC_BLIKKA_PRODUCTION_URL || 'localhost:3002'}`

export const AuthConfigLayer = Layer.succeed(AuthConfig, {
  baseUrl,
  secret: process.env.BETTER_AUTH_SECRET!,
  emailConfig: {
    companyName: 'Blikka',
    companyLogoUrl: 'https://blikka.app/images/logo.png',
  },
})

export const AuthLayer = Layer.provide(BetterAuthServiceLayer, AuthConfigLayer)
