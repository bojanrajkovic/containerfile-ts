// pattern: Functional Core

import { Result, err, ok } from "neverthrow";
import { type ParseError, type ValidationError } from "./errors.js";
import { comment } from "./instructions.js";
import { mapInstruction } from "./parse/map.js";
import { readSource, type SourceEntry } from "./parse/source.js";
import { type Placed, assemble } from "./parse/structure.js";
import type { Containerfile, Instruction } from "./types.js";

function atLine(line: number, errors: ReadonlyArray<ValidationError>): Array<ParseError> {
  return errors.map((error) => ({ ...error, line }));
}

function placeEntry(entry: SourceEntry): Result<Array<Placed>, Array<ParseError>> {
  const instructions: Result<ReadonlyArray<Instruction>, Array<ValidationError>> = entry.kind ===
  "comment"
    ? comment(...entry.lines).map((instruction) => [instruction])
    : mapInstruction(entry.keyword, entry);
  return instructions
    .map((list) => list.map((instruction) => ({ block: entry.block, instruction })))
    .mapErr((errors) => atLine(entry.line, errors));
}

/**
 * Parse Dockerfile text into a Containerfile.
 *
 * `render(parse(text))` is the same Dockerfile in normal form: keywords in upper case, one
 * space between words, blank lines kept as groups. Input the model can't represent is an
 * error, never silently dropped: an instruction it has no type for, a flag or mount it has no
 * field for, a heredoc other than one quoted delimiter on a RUN, or a `# escape=` directive
 * other than a backslash. Every error carries its 1-based line.
 *
 * @param text - Dockerfile text
 * @returns Result with the Containerfile, or every ParseError found
 *
 * @example
 * ```typescript
 * parse("FROM node:20-alpine\nWORKDIR /app\nCMD [\"node\", \"index.js\"]").match(
 *   (containerfile) => console.log(render(containerfile)),
 *   (errors) => errors.forEach((e) => console.error(`line ${e.line}: ${e.message}`)),
 * );
 * ```
 */
export function parse(text: string): Result<Containerfile, Array<ParseError>> {
  const source = readSource(text.replace(/\r\n/g, "\n"));

  if (source.escape !== null && source.escape.value !== "\\") {
    return err([
      {
        line: source.escape.line,
        field: "directive",
        message: `# escape=${source.escape.value} isn't supported`,
        value: source.escape.value,
      },
    ]);
  }

  return Result.combineWithAllErrors(source.entries.map(placeEntry))
    .mapErr((errors) => errors.flat())
    .andThen((placed) => {
      const [first, ...rest] = placed.flat();
      return first === undefined
        ? err([
            {
              line: 1,
              field: "text",
              message: "must contain at least one instruction or comment",
              value: text,
            },
          ])
        : ok(assemble([first, ...rest]));
    });
}
