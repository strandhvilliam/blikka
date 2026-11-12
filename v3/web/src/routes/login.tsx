import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../authClient.ts";
import { Button } from "../components/ui/Button.tsx";
import { FieldSeparator } from "../components/ui/Field.tsx";
import { Input } from "../components/ui/Input.tsx";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/InputOtp.tsx";
import { sessionQuery } from "../session.ts";

// Better Auth's emailOTP default.
const OTP_LENGTH = 6;

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: "/dashboard" });
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const sendOtp = async () => {
    setSubmitting(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setSubmitting(false);
    if (error) return setError(error.message);
    setError(undefined);
    setOtpSent(true);
  };

  // Stays submitting after success, so the auto-submit and a click can't both sign in.
  const verifyOtp = async (code: string) => {
    setSubmitting(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    if (error) {
      setError(error.message);
      setOtp("");
      setSubmitting(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 text-center">
        {otpSent ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              verifyOtp(otp);
            }}
          >
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold">Check your email</h1>
              <p className="text-muted-foreground">We sent a code to {email}</p>
            </div>
            <InputOTP
              aria-label="Code"
              autoFocus
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              onComplete={verifyOtp}
              disabled={submitting}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                {Array.from({ length: OTP_LENGTH }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button type="submit" size="lg" className="h-12" disabled={submitting || otp.length < OTP_LENGTH}>
              Verify code
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
                setError(undefined);
              }}
            >
              Use a different email
            </Button>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Sign in to Blikka</h1>
            <Button
              variant="outline"
              size="lg"
              className="h-12"
              onClick={() =>
                authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/dashboard` })
              }
            >
              Continue with Google
            </Button>
            <FieldSeparator>or</FieldSeparator>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendOtp();
              }}
            >
              <Input
                type="email"
                aria-label="Email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-12 text-center text-lg md:text-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="lg" className="h-12" disabled={submitting || !email}>
                Email me a code
              </Button>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
