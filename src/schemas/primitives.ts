// pattern: Functional Core

import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Value } from "@sinclair/typebox/value";
import { Result, ok, err } from "neverthrow";
import { ValidationError, validationError } from "../errors.js";

/**
 * Valid port number (0-65535, integer).
 */
export type Port = number & { readonly __brand: "Port" };

/**
 * Valid Docker image name (registry/image:tag@digest format).
 */
export type ImageName = string & { readonly __brand: "ImageName" };

/**
 * Valid Docker path (non-empty string).
 */
export type DockerPath = string & { readonly __brand: "DockerPath" };

/**
 * Schema for valid port numbers.
 * Validates: integer, range 0-65535
 */
const PortSchemaBase = Type.Integer({
  minimum: 0,
  maximum: 65535,
});

export const PortSchema = Type.Unsafe<Port>(PortSchemaBase);

/**
 * Schema for Docker image names.
 * Supports: simple names (nginx), registry paths (ghcr.io/user/app),
 * tags (node:18), digests (nginx@sha256:abc...), and variable substitution (node:${VERSION}).
 *
 * Pattern breakdown:
 * - Optional registry: (hostname:port/ or hostname/)
 * - Image path: one or more path segments separated by /
 * - Optional tag: :tagname (supports ${VARIABLE} syntax)
 * - Optional digest: @algorithm:hash
 *
 * Note: Allows $ character for Docker/Buildkit variable substitution like ${VAR}
 */
const ImageNamePattern =
  "^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?::[0-9]+)?/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::(?:[a-zA-Z0-9_][a-zA-Z0-9._${}\\-]{0,127}|\\$\\{[a-zA-Z_][a-zA-Z0-9_]*\\}(?:[a-zA-Z0-9._\\-${}-]*)?))?(?:@[a-z0-9]+:[a-f0-9]+)?$";

const ImageNameSchemaBase = Type.String({
  minLength: 1,
  pattern: ImageNamePattern,
});

export const ImageNameSchema = Type.Unsafe<ImageName>(ImageNameSchemaBase);

/**
 * Schema for Docker paths (source/destination paths in COPY, ADD, WORKDIR).
 * Validates: non-empty string.
 */
const DockerPathSchemaBase = Type.String({
  minLength: 1,
});

export const DockerPathSchema = Type.Unsafe<DockerPath>(DockerPathSchemaBase);

const CompiledPortValidator = TypeCompiler.Compile(PortSchema);
const CompiledImageNameValidator = TypeCompiler.Compile(ImageNameSchema);
const CompiledDockerPathValidator = TypeCompiler.Compile(DockerPathSchema);

/**
 * Validate a value as a Port.
 */
export function validatePort(
  value: unknown,
  field: string = "port",
): Result<Port, Array<ValidationError>> {
  if (!CompiledPortValidator.Check(value)) {
    const errors = [...Value.Errors(PortSchema, value)];
    if (errors.length === 0) {
      // Fallback if no specific errors
      return err([validationError(field, "invalid port: must be integer 0-65535", value)]);
    }
    return err(errors.map((e) => validationError(field, e.message ?? "invalid port", value)));
  }
  return ok(value as Port);
}

/**
 * Validate a value as an ImageName.
 */
export function validateImageName(
  value: unknown,
  field: string = "image",
): Result<ImageName, Array<ValidationError>> {
  if (!CompiledImageNameValidator.Check(value)) {
    const errors = [...Value.Errors(ImageNameSchema, value)];
    if (errors.length === 0) {
      return err([validationError(field, "invalid image name format", value)]);
    }
    return err(errors.map((e) => validationError(field, e.message ?? "invalid image name", value)));
  }
  return ok(value as ImageName);
}

/**
 * Check that a string fits on one rendered Dockerfile line.
 * A line break would start a new instruction, and a trailing `\` would join the next
 * instruction onto this one, so either lets a value inject instructions.
 */
function validateSingleLine<T extends string>(
  value: T,
  field: string,
): Result<T, Array<ValidationError>> {
  if (/[\r\n]/.test(value)) {
    return err([validationError(field, "must not contain line breaks", value)]);
  }
  if (value.endsWith("\\")) {
    return err([validationError(field, "must not end with a backslash", value)]);
  }
  return ok(value);
}

/**
 * Validate a value as a DockerPath.
 */
export function validateDockerPath(
  value: unknown,
  field: string = "path",
): Result<DockerPath, Array<ValidationError>> {
  if (!CompiledDockerPathValidator.Check(value)) {
    const errors = [...Value.Errors(DockerPathSchema, value)];
    if (errors.length === 0) {
      return err([validationError(field, "path must be non-empty string", value)]);
    }
    return err(errors.map((e) => validationError(field, e.message ?? "invalid path", value)));
  }
  return validateSingleLine(value as DockerPath, field);
}

/**
 * Validated port range with start <= end guarantee.
 */
export type PortRange = {
  readonly start: Port;
  readonly end: Port;
};

/**
 * Validate a port range object.
 * Collects all errors: validates both ports, then checks start <= end.
 */
export function validatePortRange(
  value: { readonly start: number; readonly end: number },
  field: string = "port",
): Result<PortRange, Array<ValidationError>> {
  return Result.combineWithAllErrors([
    validatePort(value.start, `${field}.start`),
    validatePort(value.end, `${field}.end`),
  ])
    .mapErr((errors) => errors.flat())
    .andThen(([startPort, endPort]) => {
      // Both ports valid, check start <= end
      if (startPort > endPort) {
        return err([
          validationError(
            field,
            `invalid port range: start (${startPort}) must be <= end (${endPort})`,
            value,
          ),
        ]);
      }
      return ok({ start: startPort, end: endPort });
    });
}

/**
 * Schema for non-empty strings.
 */
const NonEmptyStringSchema = Type.String({ minLength: 1 });
const CompiledNonEmptyStringValidator = TypeCompiler.Compile(NonEmptyStringSchema);

/**
 * Validate that a value is a single-line string (allows empty strings).
 * Use for runtime type checking when empty strings are valid values.
 * Rejects line breaks and a trailing backslash, which would inject instructions.
 */
export function validateString(
  value: unknown,
  field: string = "value",
): Result<string, Array<ValidationError>> {
  if (typeof value !== "string") {
    return err([validationError(field, "must be a string", value)]);
  }
  return validateSingleLine(value, field);
}

function checkNonEmptyString(
  value: unknown,
  field: string,
): Result<string, Array<ValidationError>> {
  if (!CompiledNonEmptyStringValidator.Check(value)) {
    return err([validationError(field, "must be a non-empty string", value)]);
  }
  return ok(value as string);
}

/**
 * Validate that a value is a non-empty, single-line string.
 * Rejects line breaks and a trailing backslash, which would inject instructions.
 */
export function validateNonEmptyString(
  value: unknown,
  field: string = "value",
): Result<string, Array<ValidationError>> {
  return checkNonEmptyString(value, field).andThen((str) => validateSingleLine(str, field));
}

/**
 * Validate a shell-form command (RUN, CMD, ENTRYPOINT, HEALTHCHECK).
 *
 * Multi-line commands are allowed as `\` line continuations: every line except the last
 * must end with `\`. The last line must hold a command, so the continuation can't swallow
 * the next instruction. That rules out an empty last line, a comment, or a trailing `\`.
 * Heredocs (`<<EOF`) and carriage returns are rejected.
 */
export function validateShellCommand(
  value: unknown,
  field: string = "command",
): Result<string, Array<ValidationError>> {
  return checkNonEmptyString(value, field).andThen((str) => {
    if (str.includes("\r")) {
      return err([validationError(field, "must not contain carriage returns", value)]);
    }

    const lines = str.split("\n");
    const last = str.slice(str.lastIndexOf("\n") + 1);
    if (!lines.slice(0, -1).every((line) => line.endsWith("\\"))) {
      return err([
        validationError(field, "line breaks must follow a `\\` line continuation", value),
      ]);
    }
    if (last.endsWith("\\") || last.trim() === "" || last.trimStart().startsWith("#")) {
      return err([
        validationError(field, "last line must be a command, not empty, a comment, or `\\`", value),
      ]);
    }
    return ok(str);
  });
}

/**
 * Validate an array of non-empty strings for exec (JSON) form.
 * Array must have at least one element.
 * Collects all element-level errors.
 * Elements may contain line breaks: JSON form renders them escaped as `\n`.
 */
export function validateStringArray(
  value: ReadonlyArray<unknown>,
  field: string = "values",
): Result<ReadonlyArray<string>, Array<ValidationError>> {
  if (!Array.isArray(value) || value.length === 0) {
    return err([validationError(field, "must be a non-empty array", value)]);
  }

  return Result.combineWithAllErrors(
    value.map((item, i) => checkNonEmptyString(item, `${field}[${i}]`)),
  ).mapErr((errors) => errors.flat());
}

/**
 * Validate an optional value. Returns ok(null) for undefined/null,
 * otherwise delegates to the provided validator.
 */
export function validateOptional<T>(
  value: unknown,
  validator: (v: unknown, field?: string) => Result<T, Array<ValidationError>>,
  field: string = "value",
): Result<T | null, Array<ValidationError>> {
  if (value === undefined || value === null) {
    return ok(null);
  }
  return validator(value, field);
}
