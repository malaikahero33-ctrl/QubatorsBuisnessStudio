/**
 * Remove Turbopack's dev-only type files before a production build.
 *
 * tsconfig.json includes .next/dev/types so the editor gets route types
 * while `next dev` is running. Those files are regenerated per dev session
 * and can be left half-written if the machine is interrupted, which makes
 * the next `next build` fail on them - "error TS1005" in a file nobody
 * wrote. The build itself succeeds; only the typecheck dies, which reads
 * as a broken project rather than a stale cache.
 *
 * Deleting them is safe: the build regenerates the types it needs.
 */

import { rmSync, existsSync } from "node:fs";

const target = ".next/dev";

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  console.log("cleaned stale dev types");
} else {
  console.log("no dev types to clean");
}
