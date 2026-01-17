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
  Containerfile,
  Instruction,
  Stage,
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
} from "./types.js";
import { Result, ok, err } from "neverthrow";
import {
  validateImageName,
  validateNonEmptyString,
  validateOptional,
  validateDockerPath,
  validateString,
  validateStringArray,
  validatePort,
  validatePortRange,
} from "./schemas/index.js";
import { ValidationError, prefixErrors, validationError, isReadonlyArray } from "./errors.js";

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
 * @param command - Shell form (string) or exec form (array of strings)
 * @returns Result with RunInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * // Shell form
 * const shellResult = run("npm install && npm build");
 *
 * // Exec form
 * const execResult = run(["npm", "install"]);
 * ```
 */
export function run(
  command: string | ReadonlyArray<string>,
): Result<RunInstruction, Array<ValidationError>> {
  if (typeof command === "string") {
    return validateNonEmptyString(command, "command").map(() => ({
      type: "RUN" as const,
      command,
    }));
  }

  // Array form
  return validateStringArray(command, "command").map((validatedCommand) => ({
    type: "RUN" as const,
    command: validatedCommand,
  }));
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
 * Create an ENV instruction.
 *
 * @param key - Environment variable name
 * @param value - Environment variable value (can be empty string)
 * @returns Result with EnvInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * env("NODE_ENV", "production").match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function env(key: string, value: string): Result<EnvInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateNonEmptyString(key, "key"),
    validateString(value, "value"), // Value can be empty string (valid in Dockerfile)
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
    return validateNonEmptyString(command, "command").map(() => ({
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
    return validateNonEmptyString(command, "command").map(() => ({
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
 * @param name - Build argument name
 * @param options - Optional settings (defaultValue)
 * @returns Result with ArgInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * arg("NODE_VERSION", { defaultValue: "18" }).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function arg(
  name: string,
  options?: ArgOptions,
): Result<ArgInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateNonEmptyString(name, "name"),
    validateOptional(options?.defaultValue, validateNonEmptyString, "defaultValue"),
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
 * @param key - Label key
 * @param value - Label value
 * @returns Result with LabelInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * label("version", "1.0.0").match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function label(
  key: string,
  value: string,
): Result<LabelInstruction, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validateNonEmptyString(key, "key"),
    validateString(value, "value"), // Value can be empty string (valid in Dockerfile)
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedKey, validatedValue]) => ({
      type: "LABEL" as const,
      key: validatedKey,
      value: validatedValue,
    }));
}

/**
 * Type guard to check if array contains instruction Results.
 */
function isInstructionArray(
  arr: ReadonlyArray<
    Result<Instruction, Array<ValidationError>> | Result<Stage, Array<ValidationError>>
  >,
): arr is ReadonlyArray<Result<Instruction, Array<ValidationError>>> {
  if (arr.length === 0) return true;

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
 * @param items - Array of instruction Results (single-stage) or stage Results (multi-stage)
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
 * ```
 */
export function containerfile(
  items: ReadonlyArray<Result<Instruction, Array<ValidationError>>>,
): Result<Containerfile, Array<ValidationError>>;
export function containerfile(
  items: ReadonlyArray<Result<Stage, Array<ValidationError>>>,
): Result<Containerfile, Array<ValidationError>>;
export function containerfile(
  items: ReadonlyArray<
    Result<Instruction, Array<ValidationError>> | Result<Stage, Array<ValidationError>>
  >,
): Result<Containerfile, Array<ValidationError>> {
  // Defensive: handle type bypass from JS or casting
  if (!isReadonlyArray(items)) {
    return err([validationError("items", "must be an array of instruction or stage Results", items)]);
  }

  if (items.length === 0) {
    return err([
      {
        field: "items",
        message: "containerfile must have at least one instruction or stage",
        value: items,
      },
    ]);
  }

  const errors: Array<ValidationError> = [];

  if (isInstructionArray(items)) {
    // Single-stage: array of instruction Results
    const instructions: Array<Instruction> = [];

    items.forEach((item, i) => {
      item.match(
        (instruction) => instructions.push(instruction),
        (errs) => errors.push(...prefixErrors(`instructions[${i}]`, errs)),
      );
    });

    if (errors.length > 0) {
      return err(errors);
    }

    return ok({ instructions });
  }

  // Multi-stage: array of stage Results
  // Cast needed because TypeScript can't infer the negation of isInstructionArray
  const stageItems = items as ReadonlyArray<Result<Stage, Array<ValidationError>>>;
  const stages: Array<Stage> = [];

  stageItems.forEach((item, i) => {
    item.match(
      (stage) => stages.push(stage),
      (errs) => errors.push(...prefixErrors(`stages[${i}]`, errs)),
    );
  });

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({ stages });
}
