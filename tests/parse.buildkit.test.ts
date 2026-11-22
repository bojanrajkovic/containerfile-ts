// pattern: Imperative Shell

import { expect, it } from "vitest";
import * as fc from "fast-check";
import { parse, render } from "../src/index.js";
import { describeWithBuildKit, parseWithBuildKit } from "./support/buildkit.js";

// Fields that record where an instruction was written, which parse() normalizes.
const POSITION_FIELDS = ["Location", "SourceCode", "OrigCmd", "Comments", "DocComment"];

// parse() writes one ENV, LABEL, or ARG per pair. BuildKit keeps the pairs of one instruction
// together, so the comparison runs the pairs of neighboring instructions together too.
const PAIR_FIELDS: Record<string, string> = { ENV: "Env", LABEL: "Labels", ARG: "Args" };

type Meaning = { cmd: string; error: string | undefined; command: Record<string, unknown> };

// BuildKit records whether ENV and LABEL used `name value` or `name=value`.
function withoutNoDelim(pair: unknown): unknown {
  return typeof pair === "object" && pair !== null && "NoDelim" in pair
    ? Object.fromEntries(Object.entries(pair).filter(([key]) => key !== "NoDelim"))
    : pair;
}

function mergePairs(instructions: ReadonlyArray<Meaning>): Array<Meaning> {
  return instructions
    .reduce<Array<Meaning>>((merged, next) => {
      const field = PAIR_FIELDS[next.cmd];
      const previous = merged.at(-1);
      if (field === undefined || previous?.cmd !== next.cmd) {
        return [...merged, next];
      }
      const pairs = [previous.command[field], next.command[field]].flatMap((p) =>
        Array.isArray(p) ? p : [],
      );
      return [
        ...merged.slice(0, -1),
        { ...previous, command: { ...previous.command, [field]: pairs } },
      ];
    }, [])
    .map((item) => {
      const field = PAIR_FIELDS[item.cmd];
      const pairs = field === undefined ? undefined : item.command[field];
      return field === undefined || !Array.isArray(pairs)
        ? item
        : { ...item, command: { ...item.command, [field]: pairs.map(withoutNoDelim) } };
    });
}

/** What BuildKit makes of each instruction, without where it was written. */
function meaning(dockerfile: string) {
  const parsed = parseWithBuildKit(dockerfile);
  return {
    warnings: parsed.warnings,
    // The typed command, not the raw words: parse() drops quotes and writes AS in upper case.
    instructions: mergePairs(
      parsed.instructions.map(({ cmd, error, command }) => ({
        cmd: cmd.toUpperCase(),
        error,
        command: Object.fromEntries(
          Object.entries(command ?? {}).filter(([key]) => !POSITION_FIELDS.includes(key)),
        ),
      })),
    ),
  };
}

/** `meaning`, or null when BuildKit's parser rejects the text. */
function meaningOrNull(dockerfile: string) {
  try {
    return meaning(dockerfile);
  } catch {
    return null;
  }
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
      "ENV quoting and escapes",
      String.raw`FROM a
ENV A="x y" B='$z' C=a\ b D="a\"b\\c" E=\$F G="a\qb" H=a"b c"'d e'f I= J=""`,
    ],
    ["the legacy ENV form", 'FROM a\nENV A b   c\nENV L $X y\nENV Q "b c"'],
    ["ENV with variables", 'FROM a\nENV A="${B}-x"\nENV C=$D'],
    ["ENV pairs over lines", "FROM a\nENV A=1 \\\n    B=2"],
    [
      "LABEL pairs and the legacy form",
      'FROM a\nLABEL a=b org.x="c d" v=$V\nLABEL legacy some value',
    ],
    ["ARG names and defaults", 'FROM a\nARG A=1 B C="x y" D=\nARG E=$A'],
    ["ARG before FROM", "ARG V=20\nFROM node:${V}"],
    [
      "COPY in word, quoted, and JSON form",
      'FROM a\nCOPY a b /d/\nCOPY "a" \'c\'d /e\nCOPY ["f", "g", "/h/"]',
    ],
    [
      "COPY and ADD flags",
      "FROM a AS b\nCOPY --from=b --chown=1:2 --chmod=755 x /d\nADD --chown=app:app --chmod=644 u /d/",
    ],
    ["a flag-like word after the first path", "FROM a\nCOPY a --chown=1:2 /d"],
    [
      "FROM with a platform",
      "FROM --platform=linux/amd64 a AS b\nFROM --platform=$BUILDPLATFORM c",
    ],
    [
      "HEALTHCHECK with every flag",
      "FROM a\nHEALTHCHECK --interval=90s --timeout=5s --start-period=1m --start-interval=500ms --retries=3 CMD curl -f /",
    ],
    [
      "HEALTHCHECK in exec form and NONE",
      'FROM a\nHEALTHCHECK CMD ["curl", "-f", "/"]\nHEALTHCHECK NONE',
    ],
    [
      "HEALTHCHECK continued over lines",
      "FROM a\nHEALTHCHECK --interval=5s \\\n  CMD a && \\\n  b",
    ],
    [
      "several stages",
      '# syntax=docker/dockerfile:1\nFROM a AS b\nRUN x\n\n# last\nFROM b\nSHELL ["/bin/sh", "-c"]',
    ],
  ])("reads %s as the original does", (_name, dockerfile) => {
    const reparsed = render(parse(dockerfile)._unsafeUnwrap());

    expect(meaning(reparsed)).toEqual(meaning(dockerfile));
  });

  it.each(["ENV", "LABEL", "ARG"])(
    "reads any %s value, quoted or not, the way BuildKit does",
    (keyword) => {
      // Characters BuildKit reads specially in a value: quotes, escapes, expansion, spaces.
      const value = fc.string({
        unit: fc.constantFrom("a", "x", " ", '"', "'", "\\", "$", "{", "}", "="),
        maxLength: 10,
      });
      let compared = 0;

      fc.assert(
        fc.property(value, (text) => {
          const dockerfile = `FROM a\n${keyword} K=${text}`;
          const original = meaningOrNull(dockerfile);
          const result = parse(dockerfile);
          // Skip input BuildKit rejects, and input the model can't hold: the value mixes
          // an expanding and a literal `$`, or has a second word.
          // A trailing backslash, even with spaces after it, would continue the line.
          if (
            /\\[ \t]*$/.test(text) ||
            original === null ||
            original.instructions.some((i) => i.error) ||
            result.isErr()
          ) {
            return;
          }
          compared++;

          expect(meaning(render(result._unsafeUnwrap()))).toEqual(original);
        }),
        { numRuns: 1000 },
      );

      expect(compared).toBeGreaterThan(100);
    },
  );

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
