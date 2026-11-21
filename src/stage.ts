// pattern: Functional Core

import { Result, err } from "neverthrow";
import type { Group, Instruction, NonEmptyArray, Stage } from "./types.js";
import {
  ValidationError,
  combineNonEmpty,
  prefixErrors,
  validationError,
  isReadonlyArray,
} from "./errors.js";
import { validateNonEmptyString } from "./schemas/index.js";

type EntryResults = NonEmptyArray<Result<Instruction | Group, Array<ValidationError>>>;

/**
 * Validate and combine instruction Results for a stage.
 * Returns all instructions on success, all collected errors on failure.
 */
function validateInstructionResults(
  instructions: EntryResults,
): Result<NonEmptyArray<Instruction | Group>, Array<ValidationError>> {
  // Defensive: the tuple type stops TypeScript callers, but not JS or casting
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

  return combineNonEmpty(instructions, (result, i) =>
    result.mapErr((errors) => prefixErrors(`instructions[${i}]`, errors)),
  );
}

/**
 * Create a named stage for multi-stage builds.
 *
 * Accepts an array of instruction Results and combines all errors from validation.
 * To reference this stage with COPY --from or RUN --from, you must also include
 * { as: "stagename" } in the stage's FROM instruction.
 *
 * @param name - Stage name (for organization; use FROM's `as` option for --from references)
 * @param instructions - One or more instruction or group Results from factory functions
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
  instructions: EntryResults,
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
