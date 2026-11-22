// pattern: Functional Core

import { Result, ok, err } from "neverthrow";
import type { Mount, SharingMode } from "./types.js";
import { type ValidationError, isReadonlyArray, validationError } from "./errors.js";
import {
  type DockerPath,
  validateDockerPath,
  validateNonEmptyString,
  validateOptional,
} from "./schemas/index.js";

type Errors = Array<ValidationError>;

// A mount renders as one comma-separated `key=value` flag, so a comma or quote in a value
// would add a key or end the field early, whitespace would end the flag, and BuildKit's
// Dockerfile parser treats quotes and backslashes in a flag value as quoting and escapes
// (`id=\a` reads as `a`).
const MOUNT_DELIMITER = /[,"'\\\s]/;
const DELIMITER_MESSAGE = "must not contain a comma, a quote, a backslash, or whitespace";

const SHARING_MODES: ReadonlyArray<SharingMode> = ["shared", "private", "locked"];

const MOUNT_TYPES = ["bind", "cache", "tmpfs", "secret", "ssh"] as const;

// BuildKit reads `size` with go-units' RAMInBytes: a number and an optional unit.
const SIZE = /^\d+(?:\.\d+)?[kmgtp]?i?b?$/i;

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const MAX_UID = 2 ** 32 - 1;

// Permission bits, setuid/setgid/sticky included.
const MAX_MODE = 0o7777;

function validateMountString(value: unknown, field: string): Result<string, Errors> {
  return validateNonEmptyString(value, field).andThen((str) =>
    MOUNT_DELIMITER.test(str) ? err([validationError(field, DELIMITER_MESSAGE, value)]) : ok(str),
  );
}

function validateMountPath(value: unknown, field: string): Result<DockerPath, Errors> {
  return validateDockerPath(value, field).andThen((path) =>
    MOUNT_DELIMITER.test(path) ? err([validationError(field, DELIMITER_MESSAGE, value)]) : ok(path),
  );
}

// BuildKit rejects `$` in `from`: it must name a stage or image when the Dockerfile is read.
function validateFrom(value: unknown, field: string): Result<string, Errors> {
  return validateMountString(value, field).andThen((str) =>
    str.includes("$")
      ? err([validationError(field, "must not contain a variable", value)])
      : ok(str),
  );
}

function validateEnvName(value: unknown, field: string): Result<string, Errors> {
  return typeof value === "string" && ENV_NAME.test(value)
    ? ok(value)
    : err([validationError(field, "must be an environment variable name", value)]);
}

function validateSharing(value: unknown, field: string): Result<SharingMode, Errors> {
  const mode = SHARING_MODES.find((candidate) => candidate === value);
  return mode === undefined
    ? err([validationError(field, `must be one of ${SHARING_MODES.join(", ")}`, value)])
    : ok(mode);
}

function validateSize(value: unknown, field: string): Result<string, Errors> {
  return typeof value === "string" && SIZE.test(value)
    ? ok(value)
    : err([validationError(field, "must be a size such as 64m or 1g", value)]);
}

function validateIntegerUpTo(max: number) {
  return (value: unknown, field: string): Result<number, Errors> =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
      ? ok(value)
      : err([validationError(field, `must be an integer from 0 to ${max}`, value)]);
}

const validateOwnerId = validateIntegerUpTo(MAX_UID);
const validateModeBits = validateIntegerUpTo(MAX_MODE);

function validateFlag(value: unknown, field: string): Result<boolean, Errors> {
  if (value === undefined) {
    return ok(false);
  }
  return typeof value === "boolean"
    ? ok(value)
    : err([validationError(field, "must be a boolean", value)]);
}

function validateMount(mount: unknown, field: string): Result<Mount, Errors> {
  if (typeof mount !== "object" || mount === null) {
    return err([validationError(field, "must be a mount object", mount)]);
  }

  // Untyped callers can pass anything, so read each key as unknown and validate it.
  const m: Record<string, unknown> = { ...mount };
  const key = (name: string) => `${field}.${name}`;
  const optional = <T>(
    name: string,
    validator: (value: unknown, field: string) => Result<T, Errors>,
  ) =>
    validateOptional(
      m[name],
      (value, fieldName) => validator(value, fieldName ?? key(name)),
      key(name),
    );
  const required = <T>(
    name: string,
    validator: (value: unknown, field: string) => Result<T, Errors>,
  ) => validator(m[name], key(name));

  switch (m["type"]) {
    case "bind":
      return Result.combineWithAllErrors([
        required("target", validateMountPath),
        optional("source", validateMountPath),
        optional("from", validateFrom),
        validateFlag(m["readwrite"], key("readwrite")),
      ])
        .mapErr((errors) => errors.flat())
        .map(([target, source, from, readwrite]) => ({
          type: "bind" as const,
          target,
          source,
          from,
          readwrite,
        }));

    case "cache":
      return Result.combineWithAllErrors([
        required("target", validateMountPath),
        optional("id", validateMountString),
        optional("sharing", validateSharing),
        optional("from", validateFrom),
        optional("source", validateMountPath),
        optional("mode", validateModeBits),
        optional("uid", validateOwnerId),
        optional("gid", validateOwnerId),
        validateFlag(m["readonly"], key("readonly")),
      ])
        .mapErr((errors) => errors.flat())
        .map(([target, id, sharing, from, source, mode, uid, gid, readonly]) => ({
          type: "cache" as const,
          target,
          id,
          sharing,
          from,
          source,
          mode,
          uid,
          gid,
          readonly,
        }));

    case "tmpfs":
      return Result.combineWithAllErrors([
        required("target", validateMountPath),
        optional("size", validateSize),
      ])
        .mapErr((errors) => errors.flat())
        .map(([target, size]) => ({ type: "tmpfs" as const, target, size }));

    case "secret":
      return Result.combineWithAllErrors([
        optional("id", validateMountString),
        optional("target", validateMountPath),
        optional("env", validateEnvName),
        validateFlag(m["required"], key("required")),
        optional("mode", validateModeBits),
        optional("uid", validateOwnerId),
        optional("gid", validateOwnerId),
      ])
        .mapErr((errors) => errors.flat())
        .andThen(([id, target, env, required, mode, uid, gid]) =>
          id === null && target === null
            ? err([validationError(field, "a secret mount needs an id or a target", mount)])
            : ok({ type: "secret" as const, id, target, env, required, mode, uid, gid }),
        );

    case "ssh":
      return Result.combineWithAllErrors([
        optional("id", validateMountString),
        optional("target", validateMountPath),
        validateFlag(m["required"], key("required")),
        optional("mode", validateModeBits),
        optional("uid", validateOwnerId),
        optional("gid", validateOwnerId),
      ])
        .mapErr((errors) => errors.flat())
        .map(([id, target, required, mode, uid, gid]) => ({
          type: "ssh" as const,
          id,
          target,
          required,
          mode,
          uid,
          gid,
        }));

    default:
      return err([
        validationError(key("type"), `must be one of ${MOUNT_TYPES.join(", ")}`, m["type"]),
      ]);
  }
}

/**
 * Validate the `mounts` option of `run()`. An absent option means no mounts.
 * Collects the errors of every mount, with fields like `mounts[1].target`.
 */
export function validateMounts(
  value: unknown,
  field: string = "mounts",
): Result<ReadonlyArray<Mount>, Errors> {
  if (value === undefined) {
    return ok([]);
  }
  if (!isReadonlyArray(value)) {
    return err([validationError(field, "must be an array of mounts", value)]);
  }
  return Result.combineWithAllErrors(
    value.map((mount: unknown, i) => validateMount(mount, `${field}[${i}]`)),
  ).mapErr((errors) => errors.flat());
}
