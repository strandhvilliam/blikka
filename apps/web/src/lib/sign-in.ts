"use server";

import { auth } from "./auth";

export async function signInWithPassword(email: string, password: string) {
  return auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });
}
