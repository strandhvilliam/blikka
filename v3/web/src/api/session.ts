import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { api, unwrap } from "./client.ts";
import { authClient } from "./authClient.ts";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const result = await api().GET("/me");

    if (result.response.status === 401) {
      return null;
    }

    return unwrap(result);
  },
  staleTime: 5 * 60 * 1000,
});

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    await authClient.signOut();
    queryClient.clear();
    await router.invalidate();
  };
}
