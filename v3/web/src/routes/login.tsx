import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { OTPInput, OTPInputGroup, OTPInputSlot } from "@ui-sdk/react/otp-input";
import { Separator } from "@ui-sdk/react/separator";
import { authClient } from "@/api/authClient.ts";
import { sessionQuery } from "@/api/session.ts";

// Better Auth's emailOTP default.
const OTP_LENGTH = 6;

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.session) {
      throw redirect({ to: "/dashboard" });
    }
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

    if (error) {
      return setError(error.message);
    }

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
            <OTPInput
              aria-label="Code"
              autoFocus
              maxLength={OTP_LENGTH}
              pattern="digits"
              value={otp}
              onValueChange={setOtp}
              onValueCommit={verifyOtp}
              disabled={submitting}
              className="self-center"
            >
              <OTPInputGroup>
                {Array.from({ length: OTP_LENGTH }, (_, i) => (
                  <OTPInputSlot key={i} index={i} />
                ))}
              </OTPInputGroup>
            </OTPInput>
            <Button type="submit" data-variant="solid" disabled={submitting || otp.length < OTP_LENGTH}>
              Verify code
            </Button>
            <Button
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
              onClick={() =>
                authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/dashboard` })
              }
            >
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Separator className="flex-1" />
              or
              <Separator className="flex-1" />
            </div>
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
                value={email}
                onValueChange={setEmail}
              />
              <Button type="submit" data-variant="solid" disabled={submitting || !email}>
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
