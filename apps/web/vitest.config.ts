import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineProject } from "vitest/config"

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineProject({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
})
