// The slug the Api will give a competition with this name. A copy of the Api's `slugOf`
// (server/src/competitions/schemas.ts), since the website imports nothing from the server;
// slug.test.ts fails when the two disagree.
export const slugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "") || "event";
