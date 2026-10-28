import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  casing: "snake_case",
  schema: "./src/api/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
