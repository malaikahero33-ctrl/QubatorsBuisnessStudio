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

      /**
       * `server-only` exists to make importing a server module from the client
       * a build error. It has no runtime code — it works by throwing when the
       * `react-server` condition is absent — so under Vitest, which sets no
       * such condition, it always throws.
       *
       * Stubbing it here keeps the guard in production code where it belongs
       * while letting the pure prompt and schema modules be unit tested. This
       * does NOT weaken the check: anything importing a genuinely
       * server-dependent module (a database client, a secret) will still fail
       * in the client build for a real reason.
       */
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
