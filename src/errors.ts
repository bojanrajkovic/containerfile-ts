// pattern: Functional Core

import { Result } from "neverthrow";
import type { NonEmptyArray } from "./types.js";

/**
 * Validation error returned when factory function input is invalid.
 * Field uses path notation for nested errors (e.g., "instructions[2].src").
 */
export type ValidationError = {
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
};

/**
 * A ValidationError found while parsing Dockerfile text. `line` is 1-based and points at the
 * first line of the instruction, or comment, that caused it.
 */
export type ParseError = ValidationError & { readonly line: number };

/**
 * Create a validation error with consistent structure.
 */
export function validationError(field: string, message: string, value: unknown): ValidationError {
  return { field, message, value };
}

/**
 * Prefix all errors with a path segment (e.g., "instructions[0]").
 * Used when combining errors from nested validations.
 */
export function prefixErrors(
  prefix: string,
  errors: ReadonlyArray<ValidationError>,
): Array<ValidationError> {
  return errors.map((e) => ({
    ...e,
    field: e.field ? `${prefix}.${e.field}` : prefix,
  }));
}

/**
 * Type guard that checks if a value is an array while preserving the original type.
 * Unlike Array.isArray() which widens to any[], this preserves generic type info.
 */
export function isReadonlyArray<T>(value: T): value is T & readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Validate every item of a non-empty array, collecting all errors.
 * Keeps the non-empty type, which `Result.combineWithAllErrors` alone would widen to an array.
 */
export function combineNonEmpty<A, T>(
  items: NonEmptyArray<A>,
  validate: (item: A, index: number) => Result<T, Array<ValidationError>>,
): Result<NonEmptyArray<T>, Array<ValidationError>> {
  const [head, ...tail] = items;
  return Result.combineWithAllErrors([
    validate(head, 0),
    Result.combineWithAllErrors(tail.map((item, i) => validate(item, i + 1))).mapErr((errors) =>
      errors.flat(),
    ),
  ])
    .mapErr((errors) => errors.flat())
    .map(([first, rest]) => [first, ...rest] as const);
}
