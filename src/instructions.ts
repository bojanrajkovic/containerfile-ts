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
  validateStringArray,
  validatePort,
  validatePortRange,
} from "./schemas/index.js";
import { ValidationError, prefixErrors } from "./errors.js";

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
 * Create a RUN instruction.
 * Accepts shell form (string) or exec form (array).
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

  const chownResult = validateOptional(
    options?.chown,
    validateNonEmptyString,
    "chown",
  );
  if (chownResult.isErr()) {
    errors.push(...chownResult.error);
  }

  const chmodResult = validateOptional(
    options?.chmod,
    validateNonEmptyString,
    "chmod",
  );
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
  const chownResult = validateOptional(
    options?.chown,
    validateNonEmptyString,
    "chown",
  );
  if (chownResult.isErr()) {
    errors.push(...chownResult.error);
  }

  const chmodResult = validateOptional(
    options?.chmod,
    validateNonEmptyString,
    "chmod",
  );
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
 * Create an EXPOSE instruction.
 * Accepts single port or port range.
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
 * Type guard to check if array contains instruction Results.
 */
function isInstructionArray(
  arr: ReadonlyArray<Result<Instruction, Array<ValidationError>> | Result<Stage, Array<ValidationError>>>,
): arr is ReadonlyArray<Result<Instruction, Array<ValidationError>>> {
  if (arr.length === 0) return true;
  const first = arr[0];
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
 * Create a Containerfile definition.
 *
 * @overload Single-stage: array of instruction Results
 * @overload Multi-stage: array of stage Results
 *
 * Uses Result.combineWithAllErrors pattern to collect all validation errors.
 */
export function containerfile(
  items: ReadonlyArray<Result<Instruction, Array<ValidationError>>>,
): Result<Containerfile, Array<ValidationError>>;
export function containerfile(
  items: ReadonlyArray<Result<Stage, Array<ValidationError>>>,
): Result<Containerfile, Array<ValidationError>>;
export function containerfile(
  items: ReadonlyArray<Result<Instruction, Array<ValidationError>> | Result<Stage, Array<ValidationError>>>,
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
