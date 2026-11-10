import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";

// The signed-in user, or null. Sign-in and sign-out invalidate it; the staleTime only bounds how
// long a session revoked elsewhere still shows as signed in.
export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const { data, response } = await api().GET("/me");
    if (response.status === 401) return null;
    if (!data) throw new Error(`Could not get the session: ${response.status}`);
    return data;
  },
  staleTime: 5 * 60 * 1000,
});
