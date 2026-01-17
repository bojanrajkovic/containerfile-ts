// pattern: Functional Core

import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Value } from "@sinclair/typebox/value";
import { Result, ok, err } from "neverthrow";
import { ValidationError, validationError } from "../errors.js";

// ============================================================================
// Branded Types
// ============================================================================

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

// ============================================================================
// Schemas
// ============================================================================

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
 * tags (node:18), and digests (nginx@sha256:abc...).
 *
 * Pattern breakdown:
 * - Optional registry: (hostname:port/ or hostname/)
 * - Image path: one or more path segments separated by /
 * - Optional tag: :tagname
 * - Optional digest: @algorithm:hash
 */
const ImageNamePattern =
  "^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?::[0-9]+)?/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127})?(?:@[a-z0-9]+:[a-f0-9]+)?$";

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

// ============================================================================
// Compiled Validators (compile once at module load)
// ============================================================================

const CompiledPortValidator = TypeCompiler.Compile(PortSchema);
const CompiledImageNameValidator = TypeCompiler.Compile(ImageNameSchema);
const CompiledDockerPathValidator = TypeCompiler.Compile(DockerPathSchema);

// ============================================================================
// Validation Functions
// ============================================================================

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
  return ok(value as DockerPath);
}

// ============================================================================
// Port Range Type and Validation
// ============================================================================

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
  const errors: Array<ValidationError> = [];

  // Validate start port
  const startResult = validatePort(value.start, `${field}.start`);
  if (startResult.isErr()) {
    errors.push(...startResult.error);
  }

  // Validate end port
  const endResult = validatePort(value.end, `${field}.end`);
  if (endResult.isErr()) {
    errors.push(...endResult.error);
  }

  // If either port is invalid, return collected errors
  if (errors.length > 0) {
    return err(errors);
  }

  // Both ports valid, check start <= end
  if (value.start > value.end) {
    return err([
      validationError(
        field,
        `invalid port range: start (${value.start}) must be <= end (${value.end})`,
        value,
      ),
    ]);
  }

  return ok({
    start: value.start as Port,
    end: value.end as Port,
  });
}
