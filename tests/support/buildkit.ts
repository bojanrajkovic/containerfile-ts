// pattern: Imperative Shell

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe } from "vitest";

/**
 * One instruction as BuildKit's parser sees it. `command` is the typed instruction (or
 * stage, for FROM) after variable expansion with an empty environment; its shape is
 * BuildKit's Go struct, so tests read only the fields they need.
 */
export type ParsedInstruction = {
  readonly cmd: string;
  readonly args: ReadonlyArray<string>;
  readonly flags: ReadonlyArray<string>;
  readonly heredocs: ReadonlyArray<{ name: string; expand: boolean; content: string }>;
  readonly comments: ReadonlyArray<string>;
  readonly command: Record<string, unknown> | null;
  readonly error?: string;
};

export type ParsedDockerfile = {
  readonly instructions: ReadonlyArray<ParsedInstruction>;
  readonly warnings: ReadonlyArray<string>;
};

export const goAvailable = spawnSync("go", ["version"], { stdio: "ignore" }).status === 0;

if (!goAvailable && process.env["CI"]) {
  throw new Error("Go is required in CI for the BuildKit parser tests (see .mise.toml)");
}

/**
 * `describe` when Go is installed, `describe.skip` otherwise. CI always has Go, so these
 * tests skip only on machines without it.
 */
export const describeWithBuildKit = goAvailable ? describe : describe.skip;

/** Where tests/support/buildkit-setup.ts builds the parser before the tests run. */
export const parserBinaryPath = join(
  import.meta.dirname,
  "..",
  "..",
  "node_modules",
  ".cache",
  "containerfile-ts",
  "buildkit-parse",
);

/**
 * Parse a Dockerfile with BuildKit's parser.
 *
 * @throws Error with BuildKit's message when the Dockerfile doesn't parse
 */
export function parseWithBuildKit(dockerfile: string): ParsedDockerfile {
  const result = spawnSync(parserBinaryPath, [], { input: dockerfile, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`BuildKit rejected the Dockerfile: ${result.stderr.trim()}\n${dockerfile}`);
  }
  return JSON.parse(result.stdout) as ParsedDockerfile;
}
