"use client"
import { GalleryVerticalEnd, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginAction } from "./login-action"
import { authClient } from "@/lib/auth/client"

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {
  next?: string
}

export function LoginForm({ className, next, ...props }: LoginFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-gothic text-3xl leading-tight tracking-tight text-brand-black">Sign in</h1>
        <p className="text-sm text-brand-black/60">Continue to your event dashboard.</p>
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          disabled={isSubmittingGoogle || isSubmittingEmail}
          className="h-12 w-full rounded-xl bg-brand-black text-brand-white shadow-[0_12px_35px_rgba(0,0,0,0.25)] hover:bg-brand-black/92"
          onClick={async () => {
            setIsSubmittingGoogle(true)
            setError(null)

            const result = await authClient.signIn.social({
              provider: "google",
              callbackURL: next ?? "/admin",
            })

            if (result.error) {
              setError(result.error.message ?? "Unable to continue with Google.")
              setIsSubmittingGoogle(false)
            }
          }}
        >
          <svg className="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          {isSubmittingGoogle ? "Redirecting to Google..." : "Continue with Google"}
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-brand-black/12" />
          <span className="rounded-full border border-brand-black/12 bg-brand-white/72 px-3 py-0.5 text-[11px] font-medium tracking-[0.16em] text-brand-black/50 uppercase">
            or
          </span>
          <span className="h-px flex-1 bg-brand-black/12" />
        </div>

        <button
          type="button"
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-brand-black/12 px-3 py-1.5 text-xs font-medium text-brand-black/70 transition-colors hover:border-brand-black/22 hover:text-brand-black"
          onClick={() => setShowEmailLogin((previous) => !previous)}
        >
          <Mail className="size-3.5" />
          {showEmailLogin ? "Hide email login" : "Continue with email instead"}
        </button>
      </div>

      {showEmailLogin ? (
        <form
          className="space-y-3 rounded-2xl border border-brand-black/12 bg-background/70 p-4"
          onSubmit={async (event) => {
            event.preventDefault()
            const formData = new FormData(event.target as HTMLFormElement)
            const email = formData.get("email") as string

            setIsSubmittingEmail(true)
            setError(null)

            const result = await loginAction({ email })

            if (result.error) {
              setError(result.error)
              setIsSubmittingEmail(false)
              return
            }

            const params = new URLSearchParams({
              email,
            })

            if (next) {
              params.set("next", next)
            }

            router.push(`/auth/verify?${params.toString()}`)
          }}
        >
          <label htmlFor="email" className="block text-xs font-medium tracking-wide text-brand-black/72 uppercase">
            Email login
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            disabled={isSubmittingEmail || isSubmittingGoogle}
            className="h-11 rounded-xl border-brand-black/16"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmittingEmail || isSubmittingGoogle}
            className="h-10 w-full rounded-xl border-brand-black/18 bg-brand-white text-brand-black hover:bg-brand-black/3"
          >
            {isSubmittingEmail ? "Sending code..." : "Send one-time code"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/8 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-brand-black/50">
        By continuing, you agree to the platform terms and privacy policy.
      </p>
    </div>
  )
}
