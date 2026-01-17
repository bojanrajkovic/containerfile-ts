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
import { ValidationError, prefixErrors } from "./errors.js";

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
  const errors: Array<ValidationError> = [];

  // Validate image name
  const imageResult = validateImageName(image, "image");
  if (imageResult.isErr()) {
    errors.push(...imageResult.error);
  }

  // Validate optional 'as' if provided
  const asResult = validateOptional(options?.as, validateNonEmptyString, "as");
  if (asResult.isErr()) {
    errors.push(...asResult.error);
  }

  // Validate optional 'platform' if provided
  const platformResult = validateOptional(options?.platform, validateNonEmptyString, "platform");
  if (platformResult.isErr()) {
    errors.push(...platformResult.error);
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({
    type: "FROM" as const,
    image,
    as: asResult.isOk() ? asResult.value : null,
    platform: platformResult.isOk() ? platformResult.value : null,
  });
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
    const result = validateNonEmptyString(command, "command");
    if (result.isErr()) {
      return err(result.error);
    }
    return ok({
      type: "RUN" as const,
      command,
    });
  }

  // Array form
  const result = validateStringArray([...command], "command");
  if (result.isErr()) {
    return err(result.error);
  }

  return ok({
    type: "RUN" as const,
    command: result.value,
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
  const errors: Array<ValidationError> = [];

  // Normalize src to array
  const srcArray = typeof src === "string" ? [src] : [...src];

  // Validate sources
  if (srcArray.length === 0) {
    errors.push({
      field: "src",
      message: "must have at least one source",
      value: src,
    });
  } else {
    for (let i = 0; i < srcArray.length; i++) {
      const result = validateDockerPath(srcArray[i], `src[${i}]`);
      if (result.isErr()) {
        errors.push(...result.error);
      }
    }
  }

  // Validate destination
  const destResult = validateDockerPath(dest, "dest");
  if (destResult.isErr()) {
    errors.push(...destResult.error);
  }

  // Validate optional fields
  const fromResult = validateOptional(options?.from, validateNonEmptyString, "from");
  if (fromResult.isErr()) {
    errors.push(...fromResult.error);
  }

  const chownResult = validateOptional(options?.chown, validateNonEmptyString, "chown");
  if (chownResult.isErr()) {
    errors.push(...chownResult.error);
  }

  const chmodResult = validateOptional(options?.chmod, validateNonEmptyString, "chmod");
  if (chmodResult.isErr()) {
    errors.push(...chmodResult.error);
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({
    type: "COPY" as const,
    src: srcArray,
    dest,
    from: fromResult.isOk() ? fromResult.value : null,
    chown: chownResult.isOk() ? chownResult.value : null,
    chmod: chmodResult.isOk() ? chmodResult.value : null,
  });
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
  const errors: Array<ValidationError> = [];

  // Normalize src to array
  const srcArray = typeof src === "string" ? [src] : [...src];

  // Validate sources
  if (srcArray.length === 0) {
    errors.push({
      field: "src",
      message: "must have at least one source",
      value: src,
    });
  } else {
    for (let i = 0; i < srcArray.length; i++) {
      const result = validateDockerPath(srcArray[i], `src[${i}]`);
      if (result.isErr()) {
        errors.push(...result.error);
      }
    }
  }

  // Validate destination
  const destResult = validateDockerPath(dest, "dest");
  if (destResult.isErr()) {
    errors.push(...destResult.error);
  }

  // Validate optional fields
  const chownResult = validateOptional(options?.chown, validateNonEmptyString, "chown");
  if (chownResult.isErr()) {
    errors.push(...chownResult.error);
  }

  const chmodResult = validateOptional(options?.chmod, validateNonEmptyString, "chmod");
  if (chmodResult.isErr()) {
    errors.push(...chmodResult.error);
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({
    type: "ADD" as const,
    src: srcArray,
    dest,
    chown: chownResult.isOk() ? chownResult.value : null,
    chmod: chmodResult.isOk() ? chmodResult.value : null,
  });
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
  const pathResult = validateDockerPath(path, "path");
  if (pathResult.isErr()) {
    return err(pathResult.error);
  }

  return ok({
    type: "WORKDIR" as const,
    path,
  });
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
  const keyResult = validateNonEmptyString(key, "key");
  if (keyResult.isErr()) {
    return err(keyResult.error);
  }

  // Value can be empty string (valid in Dockerfile), but must be a string
  const valueResult = validateString(value, "value");
  if (valueResult.isErr()) {
    return err(valueResult.error);
  }

  return ok({
    type: "ENV" as const,
    key,
    value,
  });
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
    const portResult = validatePort(port, "port");
    if (portResult.isErr()) {
      return err(portResult.error);
    }

    return ok({
      type: "EXPOSE" as const,
      port,
      endPort: null,
      protocol: options?.protocol ?? null,
    });
  }

  // Port range
  const rangeResult = validatePortRange(port, "port");
  if (rangeResult.isErr()) {
    return err(rangeResult.error);
  }

  return ok({
    type: "EXPOSE" as const,
    port: port.start,
    endPort: port.end,
    protocol: options?.protocol ?? null,
  });
}

/**
 * Create a CMD instruction (exec form only).
 *
 * @param command - Array of command and arguments
 * @returns Result with CmdInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * cmd(["npm", "start"]).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function cmd(
  command: ReadonlyArray<string>,
): Result<CmdInstruction, Array<ValidationError>> {
  const result = validateStringArray([...command], "command");
  if (result.isErr()) {
    return err(result.error);
  }

  return ok({
    type: "CMD" as const,
    command: result.value,
  });
}

/**
 * Create an ENTRYPOINT instruction (exec form only).
 *
 * @param command - Array of command and arguments
 * @returns Result with EntrypointInstruction on success, ValidationError[] on failure
 *
 * @example
 * ```typescript
 * entrypoint(["node", "server.js"]).match(
 *   (instruction) => console.log(instruction),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function entrypoint(
  command: ReadonlyArray<string>,
): Result<EntrypointInstruction, Array<ValidationError>> {
  const result = validateStringArray([...command], "command");
  if (result.isErr()) {
    return err(result.error);
  }

  return ok({
    type: "ENTRYPOINT" as const,
    command: result.value,
  });
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
  const nameResult = validateNonEmptyString(name, "name");
  if (nameResult.isErr()) {
    return err(nameResult.error);
  }

  // Validate defaultValue if provided (must be non-empty string)
  const defaultValueResult = validateOptional(
    options?.defaultValue,
    validateNonEmptyString,
    "defaultValue",
  );
  if (defaultValueResult.isErr()) {
    return err(defaultValueResult.error);
  }

  return ok({
    type: "ARG" as const,
    name,
    defaultValue: defaultValueResult.value,
  });
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
  const keyResult = validateNonEmptyString(key, "key");
  if (keyResult.isErr()) {
    return err(keyResult.error);
  }

  // Value can be empty string (valid in Dockerfile), but must be a string
  const valueResult = validateString(value, "value");
  if (valueResult.isErr()) {
    return err(valueResult.error);
  }

  return ok({
    type: "LABEL" as const,
    key,
    value,
  });
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
  const first = arr[0];
  if (first === undefined) return true;
  if (first.isOk()) {
    return "type" in first.value;
  }
  // If first is Err, we can't determine from it alone.
  // Try to find an Ok result.
  for (const item of arr) {
    if (item.isOk()) {
      return "type" in item.value;
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

    for (let i = 0; i < items.length; i++) {
      const result = items[i] as Result<Instruction, Array<ValidationError>>;
      if (result.isErr()) {
        errors.push(...prefixErrors(`instructions[${i}]`, result.error));
      } else {
        instructions.push(result.value);
      }
    }

    if (errors.length > 0) {
      return err(errors);
    }

    return ok({ instructions });
  }

  // Multi-stage: array of stage Results
  const stages: Array<Stage> = [];

  for (let i = 0; i < items.length; i++) {
    const result = items[i] as Result<Stage, Array<ValidationError>>;
    if (result.isErr()) {
      errors.push(...prefixErrors(`stages[${i}]`, result.error));
    } else {
      stages.push(result.value);
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({ stages });
}
