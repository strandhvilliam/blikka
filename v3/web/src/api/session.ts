import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { api, unwrap } from "./client.ts";
import { authClient } from "./authClient.ts";

// The signed-in user, or null. Sign-in and sign-out invalidate it; the staleTime only bounds how
// long a session revoked elsewhere still shows as signed in.
export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const result = await api().GET("/me");
    if (result.response.status === 401) return null;
    return unwrap(result);
  },
  staleTime: 5 * 60 * 1000,
});

// Clears every cached query, not only the session, so the next account in this tab can't be shown
// the last one's organizations. Every beforeLoad then re-runs, and a page that needs a session
// redirects to /login.
export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    queryClient.clear();
    await router.invalidate();
  };
}
