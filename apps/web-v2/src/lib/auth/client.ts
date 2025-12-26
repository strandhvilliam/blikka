import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"
import { protocol } from "@/config"

export const authClient = createAuthClient({
  baseURL: `${protocol}://${process.env.BLIKKA_PRODUCTION_URL || "localhost:3002"}`,
  plugins: [emailOTPClient()],
})

export const { useSession } = authClient
