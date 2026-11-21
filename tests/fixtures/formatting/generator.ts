// pattern: Functional Core

import { containerfile, comment, from, workdir, copy, run, cmd } from "../../../src/index.js";

const result = containerfile([
  comment("syntax=docker/dockerfile:1"),
  from("node:20-alpine"),
  comment("Install dependencies first so the layer caches", "", "between source changes."),
  workdir("/app"),
  copy("package*.json", "."),
  run("npm ci"),
  copy(".", "."),
  cmd(["node", "dist/index.js"]),
]);

if (result.isErr()) {
  throw new Error(`Fixture generation failed: ${JSON.stringify(result.error)}`);
}

export const fixture = result.value;
