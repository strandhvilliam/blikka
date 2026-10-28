import { Link, createFileRoute } from "@tanstack/react-router";
import { authClient } from "../auth-client.ts";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;
  return (
    <main>
      <h1>Blikka</h1>
      {session ? (
        <>
          <p>Signed in as {session.user.email}</p>
          <a href="/api/me">/api/me</a>{" "}
          <button type="button" onClick={() => authClient.signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <Link to="/login">Sign in</Link>
      )}
    </main>
  );
}
