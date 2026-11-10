import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../authClient.ts";
import { sessionQuery } from "../session.ts";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string>();

  const sendOtp = async () => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    if (error) return setError(error.message);
    setOtpSent(true);
  };

  const verifyOtp = async () => {
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (error) return setError(error.message);
    await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
    navigate({ to: "/" });
  };

  return (
    <main>
      <h1>Sign in</h1>
      <button type="button" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin })}>
        Continue with Google
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          otpSent ? verifyOtp() : sendOtp();
        }}
      >
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {otpSent && (
          <label>
            Code
            <input inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(e) => setOtp(e.target.value)} />
          </label>
        )}
        <button type="submit">{otpSent ? "Verify code" : "Email me a code"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
