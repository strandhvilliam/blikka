const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

export const newToken = (prefix: string) => prefix + hex(crypto.getRandomValues(new Uint8Array(32)));

export const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

  return hex(digest);
};
