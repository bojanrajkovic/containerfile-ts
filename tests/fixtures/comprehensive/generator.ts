// pattern: Functional Core

import {
  containerfile,
  from,
  arg,
  label,
  user,
  volume,
  shell,
  healthcheck,
  healthcheckNone,
  env,
  workdir,
  add,
  copy,
  run,
  expose,
  entrypoint,
  cmd,
} from "../../../src/index.js";

/**
 * Comprehensive fixture that exercises all instruction types and options:
 * - FROM with --platform and AS alias
 * - ARG with and without defaultValue
 * - LABEL instruction
 * - ENV instruction
 * - ADD with chown and chmod
 * - COPY with --from, --chown, --chmod, and array sources
 * - RUN with exec form (array)
 * - USER with and without group
 * - VOLUME with one path and several
 * - SHELL instruction
 * - HEALTHCHECK in exec form with all options, in shell form, and NONE
 * - EXPOSE with port range and UDP protocol
 * - ENTRYPOINT instruction
 * - CMD instruction
 */
const result = containerfile([
  // ARG without default (build-time variable)
  arg("NODE_VERSION"),

  // ARG with default value
  arg("APP_ENV", { defaultValue: "production" }),

  // FROM with platform and alias
  from("node:${NODE_VERSION}-alpine", { platform: "linux/amd64", as: "builder" }),

  // LABEL for metadata
  label("maintainer", "team@example.com"),
  label("version", "1.0.0"),

  // ENV for runtime configuration
  env("NODE_ENV", "${APP_ENV}"),
  env("PORT", "8080"),

  // WORKDIR
  workdir("/app"),

  // SHELL for later shell-form commands
  shell(["/bin/bash", "-c"]),

  // ADD with chown and chmod options
  add("https://example.com/config.tar.gz", "/app/config/", {
    chown: "node:node",
    chmod: "755",
  }),

  // COPY with array sources and all options
  copy(["package.json", "package-lock.json", "tsconfig.json"], "/app/", {
    chown: "node:node",
    chmod: "644",
  }),

  // RUN with exec form (array)
  run(["npm", "ci", "--production"]),

  // COPY from another stage
  copy("dist/", "/app/dist/", { from: "builder" }),

  // USER with user only, then user and group
  user("root"),
  user("node", "node"),

  // VOLUME with a single path and with several
  volume("/data"),
  volume(["/var/log", "/var/cache"]),

  // HEALTHCHECK with every option, then NONE (the last HEALTHCHECK wins at runtime)
  healthcheck(["curl", "-f", "http://localhost:8080/"], {
    interval: Temporal.Duration.from({ seconds: 30 }),
    timeout: Temporal.Duration.from({ seconds: 3 }),
    startPeriod: Temporal.Duration.from({ seconds: 5 }),
    startInterval: Temporal.Duration.from({ seconds: 1 }),
    retries: 3,
  }),
  healthcheck("curl -f http://localhost:8080/ || exit 1"),
  healthcheckNone(),

  // EXPOSE with port range and UDP protocol
  expose({ start: 5000, end: 5010 }, { protocol: "udp" }),

  // EXPOSE with single port (TCP is default, omitted in output)
  expose(8080),

  // ENTRYPOINT instruction
  entrypoint(["node", "--experimental-specifier-resolution=node"]),

  // CMD instruction
  cmd(["dist/server.js"]),
]);

if (result.isErr()) {
  throw new Error(`Fixture generation failed: ${JSON.stringify(result.error)}`);
}

export const fixture = result.value;
