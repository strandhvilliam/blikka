import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { authClient } from "../auth-client.ts";
import { sessionQuery } from "../session.ts";

export const Route = createFileRoute("/")({ component: Home });

const rootRoute = getRouteApi("__root__");

function Home() {
  const { apiUrl } = rootRoute.useLoaderData();
  const { session } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
    await router.invalidate();
  };
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
