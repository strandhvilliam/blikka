"use client"

import { Loader2, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"
import { loginAction } from "./login-action"
import { verifyAction } from "../verify/verify-action"
import { authClient } from "@/lib/auth/client"

const RESEND_COOLDOWN_SEC = 60

//TODO: Remove vibe coded stuff
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {
  next?: string
}

export function LoginForm({ className, next, ...props }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)

  const [email, setEmail] = useState("")
  const [codeSentToEmail, setCodeSentToEmail] = useState<string | null>(null)

  const [otp, setOtp] = useState("")
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldownSec, setResendCooldownSec] = useState(0)

  useEffect(() => {
    if (resendCooldownSec <= 0) {
      return
    }
    const id = window.setTimeout(() => {
      setResendCooldownSec((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearTimeout(id)
  }, [resendCooldownSec])

  const sendCode = async (targetEmail: string) => {
    const result = await loginAction({ email: targetEmail })
    if (result.error) {
      return { ok: false as const, error: result.error }
    }
    return { ok: true as const }
  }

  const handleResendCode = async () => {
    if (!codeSentToEmail || resendCooldownSec > 0 || isResending) {
      return
    }
    setIsResending(true)
    setError(null)
    const outcome = await sendCode(codeSentToEmail)
    setIsResending(false)
    if (!outcome.ok) {
      setError(outcome.error)
      return
    }
    setResendCooldownSec(RESEND_COOLDOWN_SEC)
    setVerifyError(null)
    setOtp("")
  }

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!codeSentToEmail) {
      return
    }
    if (otp.length !== 6) {
      setVerifyError("Please enter a valid 6-digit code")
      return
    }

    setIsVerifying(true)
    setVerifyError(null)

    try {
      const result = (await verifyAction({
        email: codeSentToEmail,
        otp,
        next,
      })) as { error: string | null }
      if (result.error) {
        setVerifyError(result.error)
      }
    } catch (err) {
      if (isNextRedirectError(err)) {
        return
      }
      setVerifyError("Invalid verification code. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleBackToEmail = () => {
    setCodeSentToEmail(null)
    setOtp("")
    setVerifyError(null)
    setResendCooldownSec(0)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-gothic text-3xl leading-tight tracking-tight text-brand-black">
          Sign in
        </h1>
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
              callbackURL: next ?? "/auth/redirect",
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
        <div className="space-y-4 rounded-2xl border border-brand-black/12 bg-background/70 p-4">
          {codeSentToEmail ? (
            <>
              <div className="space-y-1 text-center">
                <p className="text-xs font-medium tracking-wide text-brand-black/72 uppercase">
                  Check your inbox
                </p>
                <p className="text-sm text-brand-black/70">
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-medium text-brand-black">{codeSentToEmail}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp}>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="otp" className="text-brand-black/80">
                      Verification code
                    </FieldLabel>
                    <div className="flex justify-center pt-1">
                      <InputOTP
                        id="otp"
                        pattern={REGEXP_ONLY_DIGITS}
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        disabled={isVerifying}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {verifyError ? (
                      <FieldDescription className="text-center text-destructive">
                        {verifyError}
                      </FieldDescription>
                    ) : null}
                  </Field>
                  <Button
                    type="submit"
                    disabled={isVerifying || otp.length !== 6}
                    className="h-11 w-full rounded-xl bg-brand-black text-brand-white hover:bg-brand-black/92"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      "Verify and sign in"
                    )}
                  </Button>
                </FieldGroup>
              </form>

              <div className="flex flex-col items-center gap-2 border-t border-brand-black/10 pt-4">
                <button
                  type="button"
                  disabled={resendCooldownSec > 0 || isResending || isVerifying}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    resendCooldownSec > 0 || isResending || isVerifying
                      ? "cursor-not-allowed text-brand-black/35"
                      : "text-brand-black/70 underline-offset-4 hover:text-brand-black hover:underline",
                  )}
                  onClick={handleResendCode}
                >
                  {isResending
                    ? "Sending…"
                    : resendCooldownSec > 0
                      ? `Resend code in ${resendCooldownSec}s`
                      : "Resend code"}
                </button>
                <button
                  type="button"
                  className="text-xs text-brand-black/50 underline-offset-4 hover:text-brand-black/75 hover:underline"
                  onClick={handleBackToEmail}
                >
                  Use a different email
                </button>
              </div>
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault()
                const trimmed = email.trim()
                if (!trimmed) {
                  return
                }

                setIsSubmittingEmail(true)
                setError(null)

                const outcome = await sendCode(trimmed)

                if (!outcome.ok) {
                  setError(outcome.error)
                  setIsSubmittingEmail(false)
                  return
                }

                setCodeSentToEmail(trimmed)
                setResendCooldownSec(RESEND_COOLDOWN_SEC)
                setIsSubmittingEmail(false)
              }}
            >
              <label
                htmlFor="email"
                className="block text-xs font-medium tracking-wide text-brand-black/72 uppercase"
              >
                Email login
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmittingEmail || isSubmittingGoogle}
                className="h-11 rounded-xl border-brand-black/16"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={isSubmittingEmail || isSubmittingGoogle}
                className="h-10 w-full rounded-xl border-brand-black/18 bg-brand-white text-brand-black hover:bg-brand-black/3"
              >
                {isSubmittingEmail ? "Sending code…" : "Send one-time code"}
              </Button>
            </form>
          )}
        </div>
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
