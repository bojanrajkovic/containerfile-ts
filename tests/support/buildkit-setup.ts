// pattern: Imperative Shell

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { goAvailable, parserBinaryPath } from "./buildkit.js";

/**
 * Vitest global setup: build the BuildKit parser once, before any test runs, so the first
 * test doesn't spend its timeout downloading Go modules and compiling.
 */
export default function setup(): void {
  if (!goAvailable) {
    return;
  }
  execFileSync("go", ["build", "-o", parserBinaryPath, "."], {
    cwd: join(import.meta.dirname, "..", "buildkit"),
    stdio: ["ignore", "ignore", "inherit"],
  });
}
