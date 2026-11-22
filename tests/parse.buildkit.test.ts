// pattern: Imperative Shell

import { expect, it } from "vitest";
import * as fc from "fast-check";
import { parse, render } from "../src/index.js";
import { describeWithBuildKit, parseWithBuildKit } from "./support/buildkit.js";

// Fields that record where an instruction was written, which parse() normalizes.
const POSITION_FIELDS = ["Location", "SourceCode", "OrigCmd", "Comments", "DocComment"];

/** What BuildKit makes of each instruction, without where it was written. */
function meaning(dockerfile: string) {
  const parsed = parseWithBuildKit(dockerfile);
  return {
    warnings: parsed.warnings,
    // The typed command, not the raw words: parse() drops quotes and writes AS in upper case.
    instructions: parsed.instructions.map(({ cmd, error, command }) => ({
      cmd: cmd.toUpperCase(),
      error,
      command: Object.fromEntries(
        Object.entries(command ?? {}).filter(([key]) => !POSITION_FIELDS.includes(key)),
      ),
    })),
  };
}

describeWithBuildKit("parse() agrees with BuildKit", () => {
  it.each([
    ["continuations", "FROM a\nRUN apt-get update && \\\n    apt-get install -y curl\nRUN x"],
    ["a comment inside a continuation", "FROM a\nRUN one \\\n  # inner\n  && two\nRUN y"],
    ["exec form over several lines", 'FROM a\nRUN ["a", \\\n  "b c"]'],
    ["quoted words", "FROM a\nVOLUME \"/a\" '/c' /d\nUSER app:grp\nWORKDIR /my app"],
    ["shell form that looks like exec form", "FROM a\nCMD ['a','b']\nRUN [ -f /x ] && echo ok"],
    ["lower case keywords and extra spaces", "from   a   as   b\n  run   x    y   \n  cmd   z"],
    ["a doubled backslash at the end of a line", "FROM a\nRUN echo a\\\\\nRUN y"],
    ["ports", "FROM a\nEXPOSE 8000-8010/udp\nEXPOSE 80"],
    [
      "several stages",
      '# syntax=docker/dockerfile:1\nFROM a AS b\nRUN x\n\n# last\nFROM b\nSHELL ["/bin/sh", "-c"]',
    ],
  ])("reads %s as the original does", (_name, dockerfile) => {
    const reparsed = render(parse(dockerfile)._unsafeUnwrap());

    expect(meaning(reparsed)).toEqual(meaning(dockerfile));
  });

  it("finds the same instructions in any mix of continuations, comments, and blank lines", () => {
    const line = fc.constantFrom(
      "RUN a",
      "RUN b \\",
      "RUN c \\  ",
      "RUN d\\\\",
      "CMD x",
      "WORKDIR /w",
      "  e",
      "  f \\",
      "# note",
      "  # inner",
      "",
    );
    let compared = 0;

    fc.assert(
      fc.property(fc.array(line, { minLength: 1, maxLength: 8 }), (lines) => {
        const text = ["FROM a", ...lines].join("\n");
        const original = meaning(text);
        // Skip input BuildKit warns about or rejects, and input the model can't hold, such as
        // a continuation with no command after it.
        const result = parse(text);
        if (
          original.warnings.length > 0 ||
          original.instructions.some((i) => i.error) ||
          result.isErr()
        ) {
          return;
        }
        compared++;

        expect(meaning(render(result._unsafeUnwrap()))).toEqual(original);
      }),
      { numRuns: 300 },
    );

    // The skips must not hide the whole property.
    expect(compared).toBeGreaterThan(20);
  });
});
