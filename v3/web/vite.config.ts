import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { sentryProject } from "../sentry-project.ts";

export default defineConfig(({ mode }) => {
  const { SENTRY_AUTH_TOKEN } = loadEnv(mode, `${import.meta.dirname}/..`, "SENTRY_");

  return {
    resolve: { tsconfigPaths: true },
    build: { sourcemap: SENTRY_AUTH_TOKEN ? "hidden" : false },
    plugins: [
      tailwindcss(),
      tanstackStart({ srcDirectory: "src" }),
      viteReact(),
      sentryVitePlugin({
        ...sentryProject,
        authToken: SENTRY_AUTH_TOKEN,
        disable: !SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: [`${import.meta.dirname}/dist/client/**/*.map`] },
      }),
    ],
  };
});
