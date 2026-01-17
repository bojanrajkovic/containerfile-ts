// pattern: Functional Core

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
