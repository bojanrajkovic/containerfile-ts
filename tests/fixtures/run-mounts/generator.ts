// pattern: Functional Core

import { containerfile, from, workdir, copy, run, chain } from "../../../src/index.js";

/**
 * RUN with --mount flags: a cache mount, secret and tmpfs mounts together, a bind mount
 * from another stage, and mounts on exec form and chain commands.
 */
const result = containerfile([
  from("node:20-alpine"),
  workdir("/app"),
  copy("package*.json", "."),
  run("npm ci", {
    mounts: [{ type: "cache", target: "/root/.npm", id: "npm", sharing: "locked" }],
  }),
  run("npm publish", {
    mounts: [
      { type: "secret", id: "npm_token", env: "NPM_TOKEN", required: true },
      { type: "tmpfs", target: "/tmp", size: "64m" },
    ],
  }),
  run(["cp", "-r", "/src/dist", "/app/dist"], {
    mounts: [{ type: "bind", source: "/dist", target: "/src", from: "build", readwrite: true }],
  }),
  run(chain(["apk add curl", "curl --version"]), {
    mounts: [{ type: "cache", target: "/var/cache/apk", mode: 0o755, uid: 0, gid: 0 }],
  }),
]);

if (result.isErr()) {
  throw new Error(`Fixture generation failed: ${JSON.stringify(result.error)}`);
}

export const fixture = result.value;
