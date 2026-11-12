import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useSignOut } from "../session.ts";

export const Route = createFileRoute("/")({ component: Home });

const rootRoute = getRouteApi("__root__");

function Home() {
  const { apiUrl } = rootRoute.useLoaderData();
  const { session } = Route.useRouteContext();
  const signOut = useSignOut();
  return (
    <main>
      <h1>Blikka</h1>
      {session ? (
        <>
          <p>Signed in as {session.user.email}</p>
          <a href={`${apiUrl}/me`}>/me</a>{" "}
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </>
      ) : (
        <Link to="/login">Sign in</Link>
      )}
    </main>
  );
}
