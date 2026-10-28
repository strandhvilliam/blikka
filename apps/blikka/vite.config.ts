import { sentryVitePlugin } from "@sentry/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { sentryProject } from "./src/sentry-project.ts";

export default defineConfig(({ mode }) => {
  // Source maps are uploaded only when a token is set (deploys), never under `alchemy dev`.
  const { SENTRY_AUTH_TOKEN } = loadEnv(mode, import.meta.dirname, "SENTRY_");
  return {
    // Hidden: generated for the upload, not referenced from the shipped files.
    build: { sourcemap: SENTRY_AUTH_TOKEN ? "hidden" : false },
    plugins: [
      tanstackStart({ srcDirectory: "src/web" }),
      viteReact(),
      sentryVitePlugin({
        ...sentryProject,
        authToken: SENTRY_AUTH_TOKEN,
        disable: !SENTRY_AUTH_TOKEN,
        // The browser's maps would otherwise be served as public assets.
        sourcemaps: { filesToDeleteAfterUpload: [`${import.meta.dirname}/dist/client/**/*.map`] },
      }),
    ],
  };
});
