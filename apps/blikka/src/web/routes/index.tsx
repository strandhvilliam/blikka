import { Link, createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { authClient } from "../auth-client.ts";

export const Route = createFileRoute("/")({ component: Home });

const rootRoute = getRouteApi("__root__");

function Home() {
  const { apiUrl } = rootRoute.useLoaderData();
  const { session } = Route.useRouteContext();
  const router = useRouter();
  return (
    <main>
      <h1>Blikka</h1>
      {session ? (
        <>
          <p>Signed in as {session.user.email}</p>
          <a href={`${apiUrl}/me`}>/me</a>{" "}
          <button
            type="button"
            onClick={() => authClient.signOut().then(() => router.invalidate())}
          >
            Sign out
          </button>
        </>
      ) : (
        <Link to="/login">Sign in</Link>
      )}
    </main>
  );
}
