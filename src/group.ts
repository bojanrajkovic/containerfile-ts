// pattern: Functional Core

import { Result, ok, err } from "neverthrow";
import type { CommentInstruction, Group, Instruction } from "./types.js";
import { ValidationError, prefixErrors, validationError, isReadonlyArray } from "./errors.js";

type InstructionResults = readonly [
  Result<Instruction, Array<ValidationError>>,
  ...Array<Result<Instruction, Array<ValidationError>>>,
];

/**
 * Group related instructions. `render()` puts a blank line on each side of a group and
 * renders its comment, if any, directly above the first instruction.
 *
 * @param instructions - One or more instruction Results
 * @returns Result with Group on success, all ValidationErrors on failure
 *
 * @example
 * ```typescript
 * group(comment("Install dependencies"), [
 *   workdir("/app"),
 *   copy("package*.json", "."),
 *   run("npm ci"),
 * ]).match(
 *   (group) => console.log(group),
 *   (errors) => console.error(errors),
 * );
 * ```
 */
export function group(instructions: InstructionResults): Result<Group, Array<ValidationError>>;
/**
 * Group related instructions under a comment.
 *
 * @param comment - Comment Result from `comment()`, rendered directly above the group
 * @param instructions - One or more instruction Results
 */
export function group(
  comment: Result<CommentInstruction, Array<ValidationError>>,
  instructions: InstructionResults,
): Result<Group, Array<ValidationError>>;
export function group(
  first: Result<CommentInstruction, Array<ValidationError>> | InstructionResults,
  second?: InstructionResults,
): Result<Group, Array<ValidationError>> {
  // Without a comment, the instructions come first.
  const [comment, instructions] = Array.isArray(first)
    ? [ok(null), first as InstructionResults]
    : [
        (first as Result<CommentInstruction, Array<ValidationError>>).mapErr((errors) =>
          prefixErrors("comment", errors),
        ),
        second,
      ];

  return Result.combineWithAllErrors([comment, validateGroupInstructions(instructions)])
    .mapErr((errors) => errors.flat())
    .map(([validatedComment, validatedInstructions]) => ({
      type: "GROUP" as const,
      comment: validatedComment,
      instructions: validatedInstructions,
    }));
}

function prefixAt(
  result: Result<Instruction, Array<ValidationError>>,
  i: number,
): Result<Instruction, Array<ValidationError>> {
  return result.mapErr((errors) => prefixErrors(`instructions[${i}]`, errors));
}

function validateGroupInstructions(
  instructions: InstructionResults | undefined,
): Result<Group["instructions"], Array<ValidationError>> {
  // Defensive: the tuple type stops TypeScript callers, but not JS or casting
  if (!isReadonlyArray(instructions) || instructions.length === 0) {
    return err([
      validationError(
        "instructions",
        "must be a non-empty array of instruction Results",
        instructions,
      ),
    ]);
  }

  const [head, ...tail] = instructions;
  return Result.combineWithAllErrors([
    prefixAt(head, 0),
    Result.combineWithAllErrors(tail.map((result, i) => prefixAt(result, i + 1))).mapErr((errors) =>
      errors.flat(),
    ),
  ])
    .mapErr((errors) => errors.flat())
    .map(([first, rest]) => [first, ...rest] as const);
}
