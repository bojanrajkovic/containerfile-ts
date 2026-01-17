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
} from "./schemas/index.js";
import { ValidationError } from "./errors.js";

/**
 * Create a FROM instruction.
 * @returns Result with FromInstruction on success, ValidationError[] on failure
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
  const platformResult = validateOptional(
    options?.platform,
    validateNonEmptyString,
    "platform",
  );
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
 * Creates a RUN instruction
 */
export function run(command: string | ReadonlyArray<string>): RunInstruction {
  return {
    type: "RUN",
    command,
  };
}

/**
 * Creates a COPY instruction
 *
 * @param src - Source file path or array of source file paths
 * @param dest - Destination path in the container
 * @param options - Optional COPY options (from, chown, chmod)
 */
export function copy(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: CopyOptions,
): CopyInstruction {
  return {
    type: "COPY",
    src,
    dest,
    from: options?.from ?? null,
    chown: options?.chown ?? null,
    chmod: options?.chmod ?? null,
  };
}

/**
 * Creates an ADD instruction
 *
 * @param src - Source file path, URL, or array of source paths/URLs
 * @param dest - Destination path in the container
 * @param options - Optional ADD options (chown, chmod)
 */
export function add(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: AddOptions,
): AddInstruction {
  return {
    type: "ADD",
    src,
    dest,
    chown: options?.chown ?? null,
    chmod: options?.chmod ?? null,
  };
}

/**
 * Create a WORKDIR instruction.
 */
export function workdir(
  path: string,
): Result<WorkdirInstruction, Array<ValidationError>> {
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
 * Value can be empty string.
 */
export function env(
  key: string,
  value: string,
): Result<EnvInstruction, Array<ValidationError>> {
  const keyResult = validateNonEmptyString(key, "key");
  if (keyResult.isErr()) {
    return err(keyResult.error);
  }

  // Value can be empty string (valid in Dockerfile)
  return ok({
    type: "ENV" as const,
    key,
    value,
  });
}

/**
 * Validates a port number is within the valid range (0-65535)
 */
function validatePort(port: number, label: string): void {
  if (!Number.isInteger(port)) {
    throw new Error(`invalid ${label}: ${port} (must be an integer)`);
  }
  if (port < 0 || port > 65535) {
    throw new Error(`invalid ${label}: ${port} (must be 0-65535)`);
  }
}

/**
 * Creates an EXPOSE instruction
 *
 * @param port - Port number or port range object with start and end
 * @param options - Optional EXPOSE options (protocol: tcp, udp, or sctp)
 */
export function expose(
  port: number | { readonly start: number; readonly end: number },
  options?: ExposeOptions,
): ExposeInstruction {
  if (typeof port === "number") {
    validatePort(port, "port number");
  } else {
    validatePort(port.start, "port range start");
    validatePort(port.end, "port range end");
    if (port.start > port.end) {
      throw new Error(`invalid port range: start (${port.start}) must be <= end (${port.end})`);
    }
  }
  return {
    type: "EXPOSE",
    port,
    protocol: options?.protocol ?? "tcp",
  };
}

/**
 * Creates a CMD instruction
 */
export function cmd(command: ReadonlyArray<string>): CmdInstruction {
  return {
    type: "CMD",
    command,
  };
}

/**
 * Creates an ENTRYPOINT instruction
 */
export function entrypoint(command: ReadonlyArray<string>): EntrypointInstruction {
  return {
    type: "ENTRYPOINT",
    command,
  };
}

/**
 * Create an ARG instruction.
 */
export function arg(
  name: string,
  options?: ArgOptions,
): Result<ArgInstruction, Array<ValidationError>> {
  const nameResult = validateNonEmptyString(name, "name");
  if (nameResult.isErr()) {
    return err(nameResult.error);
  }

  return ok({
    type: "ARG" as const,
    name,
    defaultValue: options?.defaultValue ?? null,
  });
}

/**
 * Create a LABEL instruction.
 */
export function label(
  key: string,
  value: string,
): Result<LabelInstruction, Array<ValidationError>> {
  const keyResult = validateNonEmptyString(key, "key");
  if (keyResult.isErr()) {
    return err(keyResult.error);
  }

  return ok({
    type: "LABEL" as const,
    key,
    value,
  });
}

/**
 * Identity function for creating a Containerfile definition
 * Provides type safety and IDE autocompletion
 */
export function containerfile(def: Containerfile): Containerfile {
  return def;
}
