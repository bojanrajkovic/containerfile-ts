// pattern: Functional Core

import { containerfile, from, workdir, copy, run, expose, cmd } from "../../../src/index.js";

const result = containerfile([
  from("node:20-alpine"),
  workdir("/app"),
  copy("package*.json", "."),
  run("npm ci"),
  copy(".", "."),
  expose(3000),
  cmd(["node", "dist/index.js"]),
]);

if (result.isErr()) {
  throw new Error(`Fixture generation failed: ${JSON.stringify(result.error)}`);
}

export const fixture = result.value;
