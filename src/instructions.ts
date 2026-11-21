// pattern: Functional Core

import type {
  FromInstruction,
  RunInstruction,
  CopyInstruction,
  AddInstruction,
  WorkdirInstruction,
  EnvInstruction,
  ExposeInstruction,
  CmdInstruction,
  EntrypointInstruction,
  ArgInstruction,
  LabelInstruction,
  UserInstruction,
  VolumeInstruction,
  ShellInstruction,
  HealthcheckInstruction,
  HealthcheckOptions,
  CommentInstruction,
  Containerfile,
  Group,
  NonEmptyArray,
  Instruction,
  Stage,
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
  ValueOptions,
  QuotedValue,
  Heredoc,
  HeredocOptions,
} from "./types.js";
// Must load before go-duration, which throws at import if the global Temporal is missing.
import "temporal-polyfill/global";
import { createHash } from "node:crypto";
import { Result, ok, err } from "neverthrow";
import { stringifyDuration } from "@bojanrajkovic/go-duration";
import {
  validateImageName,
  validateNonEmptyString,
  validateOptional,
  validateDockerPath,
  validateLine,
  validateStringArray,
  validateShellCommand,
  validatePort,
  validatePortRange,
} from "./schemas/index.js";
import {
  ValidationError,
  combineNonEmpty,
  prefixErrors,
  validationError,
  isReadonlyArray,
} from "./errors.js";

/**
 * Validate an array of Docker paths (for COPY/ADD src).
 * Array must have at least one element.
 * Collects all element-level errors.
 */
function validateDockerPathArray(
  src: string | ReadonlyArray<string>,
  field: string,
): Result<ReadonlyArray<string>, Array<ValidationError>> {
  // String case: validate and wrap in array
  if (typeof src === "string") {
    return validateDockerPath(src, `${field}[0]`).map((path) => [path]);
  }

  // Defensive: handle type bypass from JS or casting
  if (!isReadonlyArray(src)) {
    return err([validationError(field, "must be a string or array of strings", src)]);
  }

  if (src.length === 0) {
    return err([validationError(field, "must have at least one source", src)]);
  }

  return Result.combineWithAllErrors(
    src.map((path, i) => validateDockerPath(path, `${field}[${i}]`)),
  ).mapErr((errors) => errors.flat());
}

/**
 * Create a FROM instruction.
 *
 * @param image - Docker image name (e.g., "node:18", "ghcr.io/user/app")
 * @param options - Optional settings (as, platform)
 * @returns Result with FromInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * from("node:18", { as: "builder" }).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function from(
  image: string,
  options?: FromOptions,
): Result<FromInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateImageName(image, "image"),
    validateOptional(options?.as, validateNonEmptyString, "as"),
    validateOptional(options?.platform, validateNonEmptyString, "platform"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedImage, asValue, platformValue]) => ({
      type: "FROM" as const,
      image: validatedImage,
      as: asValue,
      platform: platformValue,
    }));
}

/**
 * Create a RUN instruction.
 *
 * @param command - Shell form (string), exec form (array of strings), or a `heredoc()` Result
 * @returns Result with RunInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * // Shell form
 * const shellResult = run("npm install && npm build");
 *
 * // Exec form
 * const execResult = run(["npm", "install"]);
 *
 * // Heredoc
 * const heredocResult = run(heredoc(["set -e", "npm ci", "npm run build"]));
 * ```
 */
export function run(
  command: string | ReadonlyArray<string> | Result<Heredoc, Array<ValidationError>>,
): Result<RunInstruction, Array<ValidationError>> {
  if (typeof command === "string") {
    return validateShellCommand(command, "command").map(() => ({
      type: "RUN" as const,
      command,
    }));
  }

  if (Array.isArray(command)) {
    return validateStringArray(command, "command").map((validatedCommand) => ({
      type: "RUN" as const,
      command: validatedCommand,
    }));
  }

  // Defensive: JS callers can pass anything; only a Result has match().
  if (typeof (command as { match?: unknown } | null)?.match !== "function") {
    return err([
      validationError(
        "command",
        "must be a string, an array of strings, or a heredoc() Result",
        command,
      ),
    ]);
  }

  return (command as Result<Heredoc, Array<ValidationError>>)
    .mapErr((errors) => prefixErrors("command", errors))
    .map((validatedHeredoc) => ({ type: "RUN" as const, command: validatedHeredoc }));
}

/**
 * Pick a heredoc delimiter from the script's SHA-256. The same script always gets the same
 * delimiter, so the rendered RUN line, and BuildKit's layer cache key, stay stable.
 */
function heredocDelimiter(lines: NonEmptyArray<string>): string {
  return `EOF_${createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 8)}`;
}

/**
 * Create a heredoc script for `run()`. Each argument in `lines` is one script line.
 *
 * Renders as `RUN [interpreter ]<<'EOF_xxxxxxxx'`, the lines, then the delimiter. The delimiter
 * is derived from the script, so it never matches a script line, and quoted, so the script
 * reaches the interpreter unchanged: no `$VAR` expansion or `\` handling. Heredocs need BuildKit's
 * Dockerfile frontend 1.4 or later.
 *
 * @param lines - Script lines; may be empty but must not contain line breaks
 * @param options - Optional settings (interpreter, such as "python3")
 * @returns Result with Heredoc on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * run(heredoc(["import sys", "print(sys.version)"], { interpreter: "python3" })).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function heredoc(
  lines: NonEmptyArray<string>,
  options?: HeredocOptions,
): Result<Heredoc, Array<ValidationError>> {
  // Defensive: the tuple type stops TypeScript callers, but not JS or casting
  const validatedLines =
    isReadonlyArray(lines) && lines.length > 0
      ? combineNonEmpty(lines, (line, i) => validateLine(line, `lines[${i}]`))
      : err([validationError("lines", "must be a non-empty array of strings", lines)]);

  return Result.combineWithAllErrors([
    validatedLines,
    validateOptional(options?.interpreter, validateNonEmptyString, "interpreter"),
  ])
    .mapErr((errors) => errors.flat())
    .andThen(([script, interpreter]) => {
      const delimiter = heredocDelimiter(script);
      return script.includes(delimiter)
        ? err([validationError("lines", `must not contain the line ${delimiter}`, lines)])
        : ok({ lines: script, interpreter, delimiter });
    });
}

/**
 * Create a COPY instruction.
 *
 * @param src - Source path(s) in build context (string or array)
 * @param dest - Destination path in container
 * @param options - Optional settings (from, chown, chmod)
 * @returns Result with CopyInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * copy("package*.json", "/app", { chown: "node:node" }).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function copy(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: CopyOptions,
): Result<CopyInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateDockerPathArray(src, "src"),
    validateDockerPath(dest, "dest"),
    validateOptional(options?.from, validateNonEmptyString, "from"),
    validateOptional(options?.chown, validateNonEmptyString, "chown"),
    validateOptional(options?.chmod, validateNonEmptyString, "chmod"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([srcArray, validatedDest, fromValue, chownValue, chmodValue]) => ({
      type: "COPY" as const,
      src: srcArray,
      dest: validatedDest,
      from: fromValue,
      chown: chownValue,
      chmod: chmodValue,
    }));
}

/**
 * Create an ADD instruction.
 *
 * @param src - Source path(s) in build context (string or array)
 * @param dest - Destination path in container
 * @param options - Optional settings (chown, chmod)
 * @returns Result with AddInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * add("archive.tar.gz", "/app", { chown: "node:node" }).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function add(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: AddOptions,
): Result<AddInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateDockerPathArray(src, "src"),
    validateDockerPath(dest, "dest"),
    validateOptional(options?.chown, validateNonEmptyString, "chown"),
    validateOptional(options?.chmod, validateNonEmptyString, "chmod"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([srcArray, validatedDest, chownValue, chmodValue]) => ({
      type: "ADD" as const,
      src: srcArray,
      dest: validatedDest,
      chown: chownValue,
      chmod: chmodValue,
    }));
}

/**
 * Create a WORKDIR instruction.
 *
 * @param path - Working directory path in container
 * @returns Result with WorkdirInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * workdir("/app").match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function workdir(path: string): Result<WorkdirInstruction, Array<ValidationError>> {
  return validateDockerPath(path, "path").map((validatedPath) => ({
    type: "WORKDIR" as const,
    path: validatedPath,
  }));
}

/**
 * Validate an ENV, LABEL, or ARG key. Whitespace or `=` would split it into a different
 * key and value; quotes, `\\`, and `$` would be processed by BuildKit.
 */
function validateKey(value: unknown, field: string): Result<string, Array<ValidationError>> {
  return validateNonEmptyString(value, field).andThen((str) =>
    /[\s="'\\$]/.test(str)
      ? err([validationError(field, "must not contain whitespace, =, quotes, \\, or $", value)])
      : ok(str),
  );
}

/**
 * Validate a value that renders in double quotes. Only line breaks are rejected: quoting
 * escapes everything else.
 */
function validateQuotedValue(
  value: unknown,
  options: ValueOptions | undefined,
  field: string,
): Result<QuotedValue, Array<ValidationError>> {
  return validateLine(value, field).map((text) => ({ text, expand: options?.expand === true }));
}

/**
 * Create an ENV instruction.
 *
 * The value renders in double quotes and BuildKit stores it exactly as given. Pass
 * `{ expand: true }` to let BuildKit expand `$VAR` and `${VAR}` in it instead.
 *
 * @param key - Environment variable name; no whitespace, `=`, quotes, `\\`, or `$`
 * @param value - Environment variable value; may be empty, must not contain line breaks
 * @param options - Optional settings (expand)
 * @returns Result with EnvInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * env("DB_PASS", "hunter$2go"); // ENV DB_PASS="hunter\\$2go", stored as hunter$2go
 * env("NODE_ENV", "${APP_ENV}", { expand: true }); // reads the APP_ENV build arg
 * ```
 */
export function env(
  key: string,
  value: string,
  options?: ValueOptions,
): Result<EnvInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateKey(key, "key"),
    validateQuotedValue(value, options, "value"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedKey, validatedValue]) => ({
      type: "ENV" as const,
      key: validatedKey,
      value: validatedValue,
    }));
}

/**
 * Create an EXPOSE instruction.
 *
 * @param port - Single port number (0-65535) or port range {start, end}
 * @param options - Optional settings (protocol)
 * @returns Result with ExposeInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * // Single port
 * const singleResult = expose(3000);
 *
 * // Port range
 * const rangeResult = expose({ start: 8000, end: 8100 }, { protocol: "udp" });
 * ```
 */
export function expose(
  port: number | { readonly start: number; readonly end: number },
  options?: ExposeOptions,
): Result<ExposeInstruction, Array<ValidationError>> {
  // Single port
  if (typeof port === "number") {
    return validatePort(port, "port").map(() => ({
      type: "EXPOSE" as const,
      port,
      endPort: null,
      protocol: options?.protocol ?? null,
    }));
  }

  // Defensive: handle type bypass (null, primitives)
  if (port === null || typeof port !== "object") {
    return err([validationError("port", "must be a number or port range object", port)]);
  }

  // Port range - validatePortRange handles structure validation
  return validatePortRange(port, "port").map((range) => ({
    type: "EXPOSE" as const,
    port: range.start,
    endPort: range.end,
    protocol: options?.protocol ?? null,
  }));
}

/**
 * Create a CMD instruction.
 *
 * @param command - Shell form (string) or exec form (array of strings)
 * @returns Result with CmdInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * // Shell form
 * cmd("npm start").match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 *
 * // Exec form
 * cmd(["npm", "start"]).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function cmd(
  command: string | ReadonlyArray<string>,
): Result<CmdInstruction, Array<ValidationError>> {
  if (typeof command === "string") {
    return validateShellCommand(command, "command").map(() => ({
      type: "CMD" as const,
      command,
    }));
  }

  return validateStringArray(command, "command").map((validatedCommand) => ({
    type: "CMD" as const,
    command: validatedCommand,
  }));
}

/**
 * Create an ENTRYPOINT instruction.
 *
 * @param command - Shell form (string) or exec form (array of strings)
 * @returns Result with EntrypointInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * // Shell form
 * entrypoint("/entrypoint.sh").match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 *
 * // Exec form
 * entrypoint(["node", "server.js"]).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function entrypoint(
  command: string | ReadonlyArray<string>,
): Result<EntrypointInstruction, Array<ValidationError>> {
  if (typeof command === "string") {
    return validateShellCommand(command, "command").map(() => ({
      type: "ENTRYPOINT" as const,
      command,
    }));
  }

  return validateStringArray(command, "command").map((validatedCommand) => ({
    type: "ENTRYPOINT" as const,
    command: validatedCommand,
  }));
}

/**
 * Create an ARG instruction.
 *
 * A default value renders in double quotes and is used exactly as given, unless
 * `expand: true` lets BuildKit expand `$VAR` in it.
 *
 * @param name - Build argument name; no whitespace, `=`, quotes, `\\`, or `$`
 * @param options - Optional settings (defaultValue, expand)
 * @returns Result with ArgInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * arg("NODE_VERSION", { defaultValue: "18" }).match(
 *   (instruction) => console.log(instruction), // renders as `ARG NODE_VERSION="18"`
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function arg(
  name: string,
  options?: ArgOptions,
): Result<ArgInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateKey(name, "name"),
    options?.defaultValue === undefined
      ? ok(null)
      : validateQuotedValue(options.defaultValue, options, "defaultValue"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedName, defaultValue]) => ({
      type: "ARG" as const,
      name: validatedName,
      defaultValue,
    }));
}

/**
 * Create a LABEL instruction.
 *
 * The value renders in double quotes and is stored exactly as given, unless
 * `{ expand: true }` lets BuildKit expand `$VAR` in it.
 *
 * @param key - Label key; no whitespace, `=`, quotes, `\\`, or `$`
 * @param value - Label value; may be empty, must not contain line breaks
 * @param options - Optional settings (expand)
 * @returns Result with LabelInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * label("org.opencontainers.image.version", "${VERSION}", { expand: true }).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function label(
  key: string,
  value: string,
  options?: ValueOptions,
): Result<LabelInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateKey(key, "key"),
    validateQuotedValue(value, options, "value"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedKey, validatedValue]) => ({
      type: "LABEL" as const,
      key: validatedKey,
      value: validatedValue,
    }));
}

/**
 * Validate one side of USER's `user[:group]`: a non-empty string with no whitespace or ":".
 * Either would change how the rendered line splits into user and group.
 */
function validateUserPart(value: unknown, field: string): Result<string, Array<ValidationError>> {
  return validateNonEmptyString(value, field).andThen((str) =>
    /[\s:]/.test(str)
      ? err([validationError(field, "must not contain whitespace or ':'", value)])
      : ok(str),
  );
}

/**
 * Create a USER instruction.
 *
 * @param user - User name or UID (may be a `${VAR}` reference)
 * @param group - Optional group name or GID
 * @returns Result with UserInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * user("app", "app").match(
 *   (instruction) => console.log(instruction), // renders as `USER app:app`
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function user(
  user: string,
  group?: string,
): Result<UserInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateUserPart(user, "user"),
    group === undefined ? ok(null) : validateUserPart(group, "group"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedUser, validatedGroup]) => ({
      type: "USER" as const,
      user: validatedUser,
      group: validatedGroup,
    }));
}

/**
 * Create a VOLUME instruction.
 *
 * @param paths - Mount point path or array of paths
 * @returns Result with VolumeInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * volume(["/data", "/logs"]).match(
 *   (instruction) => console.log(instruction), // renders as `VOLUME ["/data", "/logs"]`
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function volume(
  paths: string | ReadonlyArray<string>,
): Result<VolumeInstruction, Array<ValidationError>> {
  const validated =
    typeof paths === "string"
      ? validateDockerPath(paths, "paths[0]").map((path) => [path])
      : validateStringArray(paths, "paths");

  return validated.map((validatedPaths) => ({
    type: "VOLUME" as const,
    paths: validatedPaths,
  }));
}

/**
 * Create a SHELL instruction.
 *
 * @param command - Shell executable followed by its arguments (exec form only)
 * @returns Result with ShellInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * shell(["/bin/bash", "-c"]).match(
 *   (instruction) => console.log(instruction), // renders as `SHELL ["/bin/bash", "-c"]`
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function shell(
  command: ReadonlyArray<string>,
): Result<ShellInstruction, Array<ValidationError>> {
  return validateStringArray(command, "command").map((validatedCommand) => ({
    type: "SHELL" as const,
    command: validatedCommand,
  }));
}

/**
 * Validate a Temporal.Duration and convert it to Go syntax (e.g. "1m30s").
 * stringifyDuration throws RangeError for calendar units or values outside int64 nanoseconds.
 */
function validateDuration(
  value: unknown,
  field: string = "duration",
): Result<string, Array<ValidationError>> {
  if (!(value instanceof Temporal.Duration)) {
    return err([validationError(field, "must be a Temporal.Duration", value)]);
  }
  if (value.sign < 0) {
    return err([validationError(field, "must not be negative", value)]);
  }

  try {
    return ok(stringifyDuration(value));
  } catch (error) {
    if (error instanceof RangeError) {
      return err([validationError(field, error.message, value)]);
    }
    throw error;
  }
}

function validateRetries(
  value: unknown,
  field: string = "retries",
): Result<number, Array<ValidationError>> {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? ok(value)
    : err([validationError(field, "must be a positive integer", value)]);
}

/**
 * Create a HEALTHCHECK instruction that runs a command.
 *
 * @param command - Shell form (string) or exec form (array of strings)
 * @param options - Optional settings (interval, timeout, startPeriod, startInterval, retries)
 * @returns Result with HealthcheckInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * healthcheck(["curl", "-f", "http://localhost/"], {
 *   interval: Temporal.Duration.from({ seconds: 30 }),
 *   retries: 3,
 * }).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function healthcheck(
  command: string | ReadonlyArray<string>,
  options?: HealthcheckOptions,
): Result<HealthcheckInstruction, Array<ValidationError>> {
  const validatedCommand =
    typeof command === "string"
      ? validateShellCommand(command, "command")
      : validateStringArray(command, "command");

  return Result.combineWithAllErrors([
    validatedCommand,
    validateOptional(options?.interval, validateDuration, "interval"),
    validateOptional(options?.timeout, validateDuration, "timeout"),
    validateOptional(options?.startPeriod, validateDuration, "startPeriod"),
    validateOptional(options?.startInterval, validateDuration, "startInterval"),
    validateOptional(options?.retries, validateRetries, "retries"),
  ])
    .mapErr((errors) => errors.flat())
    .map(([cmdValue, interval, timeout, startPeriod, startInterval, retries]) => ({
      type: "HEALTHCHECK" as const,
      check: "CMD" as const,
      command: cmdValue,
      interval,
      timeout,
      startPeriod,
      startInterval,
      retries,
    }));
}

/**
 * Create a `HEALTHCHECK NONE` instruction, which disables any healthcheck inherited from the base image.
 */
export function healthcheckNone(): Result<HealthcheckInstruction, Array<ValidationError>> {
  return ok({ type: "HEALTHCHECK" as const, check: "NONE" as const });
}

/**
 * Validate one comment line. A line break would end the comment and start an instruction.
 * A trailing `\` is fine: BuildKit drops comment lines before it joins continuations.
 * `escape=` is rejected because, as a parser directive, it changes the escape character
 * that every line-continuation check depends on.
 */
function validateCommentLine(
  value: unknown,
  field: string,
): Result<string, Array<ValidationError>> {
  return validateLine(value, field).andThen((line) =>
    /^\s*escape\s*=/i.test(line)
      ? err([validationError(field, "must not be an escape= parser directive", value)])
      : ok(line),
  );
}

/**
 * Create a full-line comment. Each argument is one line.
 *
 * Lines may be empty (rendered as a bare `#`), but must not contain line breaks. A comment
 * at the very top of a Dockerfile in `key=value` form, such as `syntax=docker/dockerfile:1`,
 * is read by BuildKit as a parser directive. `escape=` is rejected: the line-break checks
 * assume the default `\` escape character.
 *
 * @param line - First comment line
 * @param more - Further comment lines
 * @returns Result with CommentInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * comment("Install dependencies", "", "Uses the lockfile only.").match(
 *   (instruction) => console.log(instruction), // renders three lines: `# Install…`, `#`, `# Uses…`
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function comment(
  line: string,
  ...more: ReadonlyArray<string>
): Result<CommentInstruction, Array<ValidationError>> {
  return combineNonEmpty([line, ...more], (text, i) =>
    validateCommentLine(text, `lines[${i}]`),
  ).map((lines) => ({ type: "COMMENT" as const, lines }));
}

type EntryResults = NonEmptyArray<Result<Instruction | Group, Array<ValidationError>>>;
type StageResults = NonEmptyArray<Result<Stage, Array<ValidationError>>>;

/**
 * Type guard to check if array contains instruction Results.
 */
function isInstructionArray(arr: EntryResults | StageResults): arr is EntryResults {
  // Find any Ok result to determine if it's an instruction or stage
  for (const item of arr) {
    const isInstruction = item.match(
      (value) => "type" in value,
      () => null,
    );
    if (isInstruction !== null) {
      return isInstruction;
    }
  }
  // All are Err - default to instruction (doesn't matter, will return Err anyway)
  return true;
}

/**
 * Create a Containerfile definition supporting single-stage and multi-stage builds.
 *
 * @param items - One or more instruction or group Results (single-stage), or one or more
 *   stage Results (multi-stage)
 * @returns Result with Containerfile on success, all ValidationErrors on failure
 *
 * @example
 * ```typescript
 * // Single-stage
 * const cf1 = containerfile([
 *   from("node:18"),
 *   workdir("/app"),
 *   copy(["package.json", "package-lock.json"], "/app"),
 *   run("npm install"),
 * ]);
 *
 * // Multi-stage (note: FROM must have { as: "name" } for --from references to work)
 * const cf2 = containerfile([
 *   stage("builder", [from("node:18", { as: "builder" }), run("npm install")]),
 *   stage("runtime", [from("node:18-alpine"), copy("./dist", "/app", { from: "builder" })]),
 * ]);
 *
 * // A computed array must be narrowed to NonEmptyArray first
 * const steps = commands.map((c) => run(c));
 * if (steps.length > 0) {
 *   containerfile([from("node:18"), ...steps]);
 * }
 * ```
 */
export function containerfile(items: EntryResults): Result<Containerfile, Array<ValidationError>>;
export function containerfile(items: StageResults): Result<Containerfile, Array<ValidationError>>;
export function containerfile(
  items: EntryResults | StageResults,
): Result<Containerfile, Array<ValidationError>> {
  // Defensive: the tuple type stops TypeScript callers, but not JS or casting
  if (!isReadonlyArray(items)) {
    return err([
      validationError("items", "must be an array of instruction or stage Results", items),
    ]);
  }

  if (items.length === 0) {
    return err([
      validationError("items", "containerfile must have at least one instruction or stage", items),
    ]);
  }

  if (isInstructionArray(items)) {
    return combineNonEmpty(items, (item, i) =>
      item.mapErr((errors) => prefixErrors(`instructions[${i}]`, errors)),
    ).map((instructions) => ({ instructions }));
  }

  return combineNonEmpty(items, (item, i) =>
    item.mapErr((errors) => prefixErrors(`stages[${i}]`, errors)),
  ).map((stages) => ({ stages }));
}
