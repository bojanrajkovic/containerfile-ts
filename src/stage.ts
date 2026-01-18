// pattern: Functional Core

import { Result, err } from "neverthrow";
import type { Instruction, Stage } from "./types.js";
import { ValidationError, prefixErrors, validationError, isReadonlyArray } from "./errors.js";
import { validateNonEmptyString } from "./schemas/index.js";

/**
 * Validate and combine instruction Results for a stage.
 * Returns all instructions on success, all collected errors on failure.
 */
function validateInstructionResults(
  instructions: ReadonlyArray<Result<Instruction, Array<ValidationError>>>,
): Result<Array<Instruction>, Array<ValidationError>> {
  // Defensive: handle type bypass from JS or casting
  if (!isReadonlyArray(instructions)) {
    return err([
      validationError("instructions", "must be an array of instruction Results", instructions),
    ]);
  }

  if (instructions.length === 0) {
    return err([
      validationError("instructions", "stage must have at least one instruction", instructions),
    ]);
  }

  // Map each instruction result to prefix errors with index
  const prefixedResults = instructions.map((result, i) =>
    result.mapErr((errors) => prefixErrors(`instructions[${i}]`, errors)),
  );

  return Result.combineWithAllErrors(prefixedResults).mapErr((errors) => errors.flat());
}

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
  return Result.combineWithAllErrors([
    validateNonEmptyString(name, "name"),
    validateInstructionResults(instructions),
  ])
    .mapErr((errors) => errors.flat())
    .map(([validatedName, validatedInstructions]) => ({
      name: validatedName,
      instructions: validatedInstructions,
    }));
}
