// pattern: Functional Core

import { Result, ok, err } from "neverthrow";
import type { Instruction, Stage } from "./types.js";
import { ValidationError, prefixErrors } from "./errors.js";
import { validateNonEmptyString } from "./schemas/index.js";

/**
 * Create a named stage for multi-stage builds.
 *
 * Accepts an array of instruction Results and combines all errors from validation.
 * Stage names can be used in COPY and RUN instructions with --from=name syntax.
 *
 * @param name - Stage name (used in --from=name references)
 * @param instructions - Array of instruction Results from factory functions
 * @returns Result with Stage on success, all ValidationErrors on failure
 *
 * @example
 * ```typescript
 * const builder = stage("builder", [
 *   from("node:18"),
 *   workdir("/app"),
 *   copy(["package.json", "package-lock.json"], "/app"),
 *   run("npm install"),
 * ]);
 *
 * if (builder.isOk()) {
 *   console.log(builder.value); // Stage
 * } else {
 *   console.error(builder.error); // ValidationError[]
 * }
 * ```
 */
export function stage(
  name: string,
  instructions: ReadonlyArray<Result<Instruction, Array<ValidationError>>>,
): Result<Stage, Array<ValidationError>> {
  const errors: Array<ValidationError> = [];

  // Validate stage name
  const nameResult = validateNonEmptyString(name, "name");
  if (nameResult.isErr()) {
    errors.push(...nameResult.error);
  }

  // Validate instructions array is not empty
  if (instructions.length === 0) {
    errors.push({
      field: "instructions",
      message: "stage must have at least one instruction",
      value: instructions,
    });
  }

  // Collect errors from each instruction, prefixing with index
  const validInstructions: Array<Instruction> = [];

  for (let i = 0; i < instructions.length; i++) {
    const result = instructions[i];
    if (result === undefined) continue;
    if (result.isErr()) {
      errors.push(...prefixErrors(`instructions[${i}]`, result.error));
    } else {
      validInstructions.push(result.value);
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({
    name,
    instructions: validInstructions,
  });
}
