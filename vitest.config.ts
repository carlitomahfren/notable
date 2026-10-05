import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const projectRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.tsx",
      "app/**/__tests__/**/*.test.ts",
    ],
    globals: false,
  },
})