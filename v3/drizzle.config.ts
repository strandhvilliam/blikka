import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  casing: "snake_case",
  schema: "./server/src/db/model.ts",
  out: "./server/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
