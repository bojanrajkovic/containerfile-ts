// pattern: Functional Core

import { Result, ok, err } from "neverthrow";
import type { Instruction, Stage } from "./types.js";
import { ValidationError, prefixErrors } from "./errors.js";
import { validateNonEmptyString } from "./schemas/index.js";

/**
 * Create a named stage for multi-stage builds.
 *
 * Accepts an array of instruction Results and combines all errors from validation.
 * To reference this stage with COPY --from or RUN --from, you must also include
 * { as: "stagename" } in the stage's FROM instruction.
 *
 * @param name - Stage name (for organization; use FROM's `as` option for --from references)
 * @param instructions - Array of instruction Results from factory functions
 * @returns Result with Stage on success, all ValidationErrors on failure
 *
 * @example
 * ```typescript
 * // Use { as: "builder" } in FROM to make stage referenceable via --from
 * stage("builder", [
 *   from("node:18", { as: "builder" }),
 *   workdir("/app"),
 *   copy(["package.json", "package-lock.json"], "/app"),
 *   run("npm install"),
 * ]).match(
 *   (stage) => console.log(stage),
 *   (errors) => console.error(errors),
 * );
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
