import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest does not read tsconfig.json path aliases, so `@/lib/...` fails to
 * resolve in tests unless the alias is declared here. money.test.ts passed
 * only because it imports relatively - anything using the alias breaks.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "archive/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\\$/, ""),
    },
  },
});
