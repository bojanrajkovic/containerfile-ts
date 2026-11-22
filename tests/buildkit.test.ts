// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ok, type Result } from "neverthrow";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  arg,
  chain,
  comment,
  env,
  label,
  containerfile,
  from,
  heredoc,
  render,
  run,
  type Containerfile,
  type Group,
  type Instruction,
  type MountOptions,
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

  it("an accepted chain() is one RUN that runs every step", () => {
    fc.assert(
      fc.property(fc.array(lineHostile, { minLength: 1, maxLength: 4 }), (steps) => {
        const [first, ...rest] = steps;
        chain([first ?? "", ...rest]).map((validated) => {
          const parsed = parseWithBuildKit(
            render(build([from("alpine"), run(ok(validated)), run("true")])),
          );
          expect(parsed.instructions.map((i) => i.cmd)).toEqual(["FROM", "RUN", "RUN"]);
          const cmdLine = parsed.instructions[1]?.command?.["CmdLine"] as ReadonlyArray<string>;
          // BuildKit joins each continuation onto the next line and trims the ends.
          expect(cmdLine).toEqual([validated.steps.join("     && ").trim()]);
        });
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

  describe("RUN --mount", () => {
    function parsedMounts(mounts: ReadonlyArray<MountOptions>) {
      const parsed = parseWithBuildKit(
        render(build([from("alpine"), run("true", { mounts }), run("true")])),
      );
      expect(parsed.warnings).toEqual([]);
      expect(parsed.instructions.map((i) => i.cmd)).toEqual(["FROM", "RUN", "RUN"]);
      expect(parsed.instructions[1]?.error).toBeUndefined();
      return parsed.instructions[1]?.mounts ?? [];
    }

    it("reads every option of every mount type as modeled", () => {
      expect(
        parsedMounts([
          { type: "bind", source: ".", target: "/src", from: "build", readwrite: true },
          { type: "bind", target: "/ro" },
          {
            type: "cache",
            target: "/c",
            id: "npm",
            sharing: "locked",
            from: "base",
            source: "/s",
            mode: 0o755,
            uid: 1000,
            gid: 1001,
            readonly: true,
          },
          { type: "cache", target: "/rw" },
          { type: "tmpfs", target: "/tmp", size: "64m" },
          {
            type: "secret",
            id: "npmrc",
            target: "/root/.npmrc",
            env: "NPM_TOKEN",
            required: true,
            mode: 0o600,
            uid: 0,
            gid: 2,
          },
          { type: "ssh", id: "default", target: "/ssh", required: true, mode: 0o600, uid: 3 },
        ]),
      ).toMatchObject([
        { Type: "bind", Source: ".", Target: "/src", From: "build", ReadOnly: false },
        { Type: "bind", Target: "/ro", ReadOnly: true },
        {
          Type: "cache",
          Target: "/c",
          CacheID: "npm",
          CacheSharing: "locked",
          From: "base",
          Source: "/s",
          Mode: 0o755,
          UID: 1000,
          GID: 1001,
          ReadOnly: true,
        },
        { Type: "cache", Target: "/rw", ReadOnly: false },
        { Type: "tmpfs", Target: "/tmp", SizeLimit: 64 * 1024 * 1024 },
        {
          Type: "secret",
          CacheID: "npmrc",
          Target: "/root/.npmrc",
          Env: "NPM_TOKEN",
          Required: true,
          Mode: 0o600,
          UID: 0,
          GID: 2,
        },
        { Type: "ssh", CacheID: "default", Target: "/ssh", Required: true, Mode: 0o600, UID: 3 },
      ]);
    });

    it("reads a mount and a heredoc on the same RUN", () => {
      const parsed = parseWithBuildKit(
        render(
          build([
            from("alpine"),
            run(heredoc(["print(1)"], { interpreter: "python3" }), {
              mounts: [{ type: "cache", target: "/c", id: "pip" }],
            }),
          ]),
        ),
      );

      expect(parsed.instructions[1]?.error).toBeUndefined();
      expect(parsed.instructions[1]?.mounts).toMatchObject([
        { Type: "cache", Target: "/c", CacheID: "pip" },
      ]);
      expect(parsed.instructions[1]?.heredocs.map((h) => [h.expand, h.content])).toEqual([
        [false, "print(1)\n"],
      ]);
    });

    it("an accepted mount is one mount with the modeled target, whatever the characters", () => {
      // `$` is left out: BuildKit expands it, by design, so the target wouldn't match.
      const text = fc.string({
        unit: fc.constantFrom(
          "a",
          "/",
          ",",
          '"',
          "=",
          " ",
          "\t",
          "'",
          "\\",
          "#",
          "\n",
          "<",
          "&",
          ";",
          "`",
          "{",
        ),
        minLength: 1,
        maxLength: 10,
      });
      fc.assert(
        fc.property(text, text, (target, id) => {
          const result = run("true", { mounts: [{ type: "cache", target, id }] });
          result.map(() => {
            const [mount, ...more] = parsedMounts([{ type: "cache", target, id }]);
            expect(more).toEqual([]);
            expect(mount).toMatchObject({ Type: "cache", Target: target, CacheID: id });
          });
        }),
        { numRuns: 300 },
      );
    });
  });

  describe("ENV, LABEL, and ARG values", () => {
    // Characters BuildKit treats specially in a value: quotes, escapes, expansion, splitting.
    const value = fc.string({
      unit: fc.constantFrom("a", " ", "\t", '"', "'", "\\", "$", "{", "}", "=", "#", "`"),
      maxLength: 12,
    });
    const key = fc.constantFrom("K", "org.example.key", "MY_VAR-1");

    type Pair = { readonly Key: string; readonly Value: string | null };
    const firstPair = (parsed: ReturnType<typeof parseWithBuildKit>, field: string): Pair =>
      (parsed.instructions[1]?.command?.[field] as ReadonlyArray<Pair>)[0] as Pair;

    it.each([
      ["ENV", "Env", (k: string, v: string) => env(k, v)],
      ["LABEL", "Labels", (k: string, v: string) => label(k, v)],
      ["ARG", "Args", (k: string, v: string) => arg(k, { defaultValue: v })],
    ] as const)("%s stores any accepted value exactly", (cmd, field, make) => {
      fc.assert(
        fc.property(key, value, (k, v) => {
          const parsed = parseWithBuildKit(render(build([from("alpine"), make(k, v)])));
          expect(parsed.instructions.map((i) => i.cmd)).toEqual(["FROM", cmd]);
          expect(firstPair(parsed, field)).toMatchObject({ Key: k, Value: v });
        }),
        { numRuns: 200 },
      );
    });

    it("expand: true lets BuildKit expand variables", () => {
      const parsed = parseWithBuildKit(
        render(build([from("alpine"), env("K", 'a ${UNSET}"b', { expand: true })])),
      );
      expect(firstPair(parsed, "Env")).toMatchObject({ Key: "K", Value: 'a "b' });
    });
  });
});
