// pattern: Functional Core

import { DockerfileParser } from "dockerfile-ast";
import { HEREDOC_REDIRECT, LINE_CONTINUATION } from "../schemas/primitives.js";
import type { NonEmptyArray } from "../types.js";

/**
 * One comment or instruction of a Dockerfile, in source order. `line` is 1-based and
 * `block` numbers the runs of lines that blank lines separate.
 */
export type SourceEntry =
  | {
      readonly kind: "comment";
      readonly line: number;
      readonly block: number;
      readonly lines: NonEmptyArray<string>;
    }
  | {
      readonly kind: "instruction";
      readonly line: number;
      readonly block: number;
      /** Upper case, as `dockerfile-ast` reports it. */
      readonly keyword: string;
      /** Text after the keyword, `\` continuations kept and comment lines inside it removed. */
      readonly raw: string;
      /** `raw` with the continuations joined, the way BuildKit reads the instruction. */
      readonly joined: string;
    };

export type Source = {
  readonly entries: ReadonlyArray<SourceEntry>;
  /** The `# escape=` parser directive, if the file has one. */
  readonly escape: { readonly line: number; readonly value: string } | null;
};

// A `\` that ends a line continues it, unless the `\` is itself escaped.
const CONTINUATION = /(^|[^\\])\\[ \t]*\n/g;

function commentText(line: string): string {
  const text = line.trim().slice(1);
  return (text.startsWith(" ") ? text.slice(1) : text).trimEnd();
}

/** Where an instruction sits in the text: 0-based lines, and where its keyword ends. */
type Located = {
  readonly start: number;
  readonly end: number;
  readonly keyword: string;
  readonly keywordEnd: number;
};

/**
 * The last line of the instruction that starts at `start` and that `dockerfile-ast` ends at
 * `end`, as BuildKit reads it. `dockerfile-ast` continues an instruction past a line that
 * ends in `\\`, but BuildKit doesn't: that `\` is escaped. Heredoc bodies don't end in `\`,
 * so an instruction that starts a heredoc keeps its range.
 */
function lastLine(lines: ReadonlyArray<string>, start: number, end: number): number {
  if (HEREDOC_REDIRECT.test(lines[start] ?? "")) {
    return end;
  }
  for (let i = start; i < end; i++) {
    const text = (lines[i] ?? "").trim();
    const skipped = i > start && (text === "" || text.startsWith("#"));
    if (!skipped && !LINE_CONTINUATION.test(lines[i] ?? "")) {
      return i;
    }
  }
  return end;
}

/**
 * Find every instruction with `dockerfile-ast`. Where BuildKit would end one earlier, the
 * lines after it are parsed again as a new Dockerfile.
 */
function locate(lines: ReadonlyArray<string>, offset: number): Array<Located> {
  const found: Array<Located> = [];
  for (const instruction of DockerfileParser.parse(lines.join("\n")).getInstructions()) {
    const start = instruction.getRange().start.line;
    const end = instruction.getRange().end.line;
    const last = lastLine(lines, start, end);
    found.push({
      start: start + offset,
      end: last + offset,
      keyword: instruction.getKeyword(),
      keywordEnd: instruction.getInstructionRange().end.character,
    });
    if (last < end) {
      return [...found, ...locate(lines.slice(last + 1), offset + last + 1)];
    }
  }
  return found;
}

/**
 * Split Dockerfile text into comments and instructions. `dockerfile-ast` finds where each
 * instruction starts and ends. Everything else comes from the text, because its argument
 * values ignore quotes and drop spaces from JSON strings.
 *
 * @param text - Dockerfile text with `\n` line endings
 */
export function readSource(text: string): Source {
  const lines = text.split("\n");
  const instructions = new Map(
    locate(lines, 0).map((instruction) => [instruction.start, instruction]),
  );
  const directive = DockerfileParser.parse(text)
    .getDirectives()
    .find((d) => d.getName().toLowerCase() === "escape");
  const directiveLine = directive?.getRange().start.line;

  const entries: Array<SourceEntry> = [];
  let block = 0;
  let afterBlank = false;
  const enter = () => {
    if (afterBlank) {
      block++;
      afterBlank = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const instruction = instructions.get(i);

    if (instruction !== undefined) {
      enter();
      const end = instruction.end;
      const kept = [line.slice(instruction.keywordEnd).trimStart()];
      for (let j = i + 1; j <= end; j++) {
        const next = lines[j] ?? "";
        if (next.trim() === "") {
          continue;
        }
        if (next.trim().startsWith("#")) {
          // BuildKit drops a comment inside a continued instruction. Keep its text above the instruction.
          entries.push({ kind: "comment", line: j + 1, block, lines: [commentText(next)] });
          continue;
        }
        kept.push(next);
      }
      const raw = kept.join("\n").trimEnd();
      entries.push({
        kind: "instruction",
        line: i + 1,
        block,
        keyword: instruction.keyword,
        raw,
        joined: raw.replace(CONTINUATION, "$1"),
      });
      i = end;
    } else if (line.trim() === "") {
      afterBlank = true;
    } else if (line.trim().startsWith("#") && i !== directiveLine) {
      enter();
      const previous = entries.at(-1);
      if (
        previous?.kind === "comment" &&
        previous.block === block &&
        previous.line + previous.lines.length === i + 1
      ) {
        entries[entries.length - 1] = {
          ...previous,
          lines: [...previous.lines, commentText(line)],
        };
      } else {
        entries.push({ kind: "comment", line: i + 1, block, lines: [commentText(line)] });
      }
    }
  }

  return {
    entries,
    escape:
      directive === undefined
        ? null
        : { line: directive.getRange().start.line + 1, value: directive.getValue() },
  };
}
