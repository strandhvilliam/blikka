"use client"

import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { verifyAction } from "./verify-action"

interface VerifyFormProps {
  email: string
  className?: string
}

export function VerifyForm({ email, className }: VerifyFormProps) {
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await verifyAction({
        email,
        otp,
      })
    } catch (err) {
      console.error("OTP verification error:", err)
      setError("Invalid verification code. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold">Verify your email</h1>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {email}</p>
          </div>
          <Field>
            <FieldLabel htmlFor="otp">Verification Code</FieldLabel>
            <div className="flex justify-center">
              <InputOTP
                pattern={REGEXP_ONLY_DIGITS}
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isSubmitting}
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
            {error && <FieldDescription className="text-destructive">{error}</FieldDescription>}
          </Field>
          <Field>
            <Button type="submit" disabled={isSubmitting || otp.length !== 6} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Email"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
