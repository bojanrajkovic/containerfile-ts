// pattern: Imperative Shell

import { it, expect } from "vitest";
import * as fc from "fast-check";
import { ok, type Result } from "neverthrow";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  comment,
  containerfile,
  from,
  heredoc,
  render,
  run,
  type Containerfile,
  type Group,
  type Instruction,
  type NonEmptyArray,
  type ValidationError,
} from "../src/index.js";
import { LINE_BREAK } from "../src/schemas/primitives.js";
import { describeWithBuildKit, parseWithBuildKit } from "./support/buildkit.js";

/** Instruction types the model holds, in order, as BuildKit would count them. */
function modelCommands(cf: Containerfile): Array<string> {
  const entries: ReadonlyArray<Instruction | Group> =
    "instructions" in cf ? cf.instructions : cf.stages.flatMap((s) => s.instructions);
  return entries
    .flatMap((entry) => (entry.type === "GROUP" ? entry.instructions : [entry]))
    .filter((instruction) => instruction.type !== "COMMENT")
    .map((instruction) => instruction.type);
}

function build(
  items: NonEmptyArray<Result<Instruction | Group, Array<ValidationError>>>,
): Containerfile {
  return containerfile(items)._unsafeUnwrap();
}

// Characters that can break, join, or comment out Dockerfile lines.
const lineHostile = fc.string({
  unit: fc.constantFrom("a", " ", "\t", "#", "\\", "\n", "\r", "<", "E", '"', "'"),
  maxLength: 12,
});

describeWithBuildKit("BuildKit parses rendered output as modeled", () => {
  const fixturesDir = join(import.meta.dirname, "fixtures");
  const fixtures = readdirSync(fixturesDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const { name } of fixtures) {
    it(`fixture ${name} has the modeled instructions and no warnings`, async () => {
      const { fixture } = (await import(join(fixturesDir, name, "generator.ts"))) as {
        fixture: Containerfile;
      };
      const parsed = parseWithBuildKit(render(fixture));

      expect(parsed.warnings).toEqual([]);
      expect(parsed.instructions.map((i) => i.error ?? null)).toEqual(
        parsed.instructions.map(() => null),
      );
      expect(parsed.instructions.map((i) => i.cmd.toUpperCase())).toEqual(modelCommands(fixture));
    });
  }

  it("an accepted shell-form run() is exactly one RUN", () => {
    fc.assert(
      fc.property(lineHostile, (command) => {
        run(command).map((instruction) => {
          const parsed = parseWithBuildKit(render(build([from("alpine"), ok(instruction)])));
          expect(parsed.instructions.map((i) => i.cmd)).toEqual(["FROM", "RUN"]);
          expect(parsed.instructions[1]?.heredocs).toEqual([]);
        });
      }),
      { numRuns: 200 },
    );
  });

  it("a heredoc script reaches BuildKit unchanged and unexpanded", () => {
    const scriptLine = fc.string({ maxLength: 16 }).filter((s) => !LINE_BREAK.test(s));
    fc.assert(
      fc.property(fc.array(scriptLine, { minLength: 1, maxLength: 5 }), (lines) => {
        const [first, ...rest] = lines;
        const parsed = parseWithBuildKit(
          render(build([from("alpine"), run(heredoc([first ?? "", ...rest]))])),
        );
        expect(parsed.instructions.map((i) => i.cmd)).toEqual(["FROM", "RUN"]);
        const [doc] = parsed.instructions[1]?.heredocs ?? [];
        expect(doc?.expand).toBe(false);
        expect(doc?.content).toBe(`${lines.join("\n")}\n`);
      }),
      { numRuns: 200 },
    );
  });

  it("an accepted comment() never becomes an instruction", () => {
    fc.assert(
      fc.property(fc.array(lineHostile, { minLength: 1, maxLength: 3 }), (lines) => {
        const [first, ...rest] = lines;
        comment(first ?? "", ...rest).map((instruction) => {
          const parsed = parseWithBuildKit(
            render(build([from("alpine"), ok(instruction), run("true")])),
          );
          expect(parsed.instructions.map((i) => i.cmd)).toEqual(["FROM", "RUN"]);
        });
      }),
      { numRuns: 200 },
    );
  });
});
