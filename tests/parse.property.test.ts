// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { Result } from "neverthrow";
import {
  cmd,
  comment,
  containerfile,
  entrypoint,
  expose,
  from,
  group,
  parse,
  render,
  run,
  shell,
  stage,
  user,
  volume,
  workdir,
  type Containerfile,
  type Group,
  type Instruction,
  type NonEmptyArray,
  type Stage,
  type ValidationError,
} from "../src/index.js";

type Built<T> = Result<T, Array<ValidationError>>;
type Entry = Built<Instruction | Group>;
type Chunk = readonly [ReadonlyArray<Built<Instruction>>, boolean];

const word = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const words = fc.array(word, { minLength: 1, maxLength: 3 });

// Only instructions parse() reads in this release.
const instruction: fc.Arbitrary<Built<Instruction>> = fc.oneof(
  word.map((w) => workdir(`/${w}`)),
  fc.tuple(word, fc.option(word, { nil: undefined })).map(([u, g]) => user(u, g)),
  words.map((ws) => volume(ws.map((w) => `/${w}`))),
  // "tcp" is left out: it renders as no suffix, so it parses back as no protocol.
  fc
    .tuple(fc.integer({ min: 0, max: 65535 }), fc.constantFrom(undefined, "udp", "sctp" as const))
    .map(([port, protocol]) => expose(port, protocol === undefined ? {} : { protocol })),
  fc.integer({ min: 0, max: 60000 }).map((start) => expose({ start, end: start + 10 })),
  words.map((ws) => cmd(ws)),
  words.map((ws) => cmd(ws.join(" "))),
  words.map((ws) => entrypoint(ws)),
  words.map((ws) => run(ws)),
  words.map((ws) => run(ws.join(" && "))),
  words.map((ws) => run(`${ws.join(" ")} \\\n    && true`)),
  fc.constant(shell(["/bin/sh", "-c"])),
  words.map(([first, ...rest]) => comment(first ?? "x", ...rest)),
);

// Each chunk of a stage is either left plain or wrapped in a group.
const chunks = fc.array(
  fc.tuple(fc.array(instruction, { minLength: 1, maxLength: 4 }), fc.boolean()),
  { minLength: 1, maxLength: 4 },
);

function nonEmpty<T>(items: ReadonlyArray<T>): NonEmptyArray<T> {
  const [first, ...rest] = items;
  if (first === undefined) {
    throw new Error("expected at least one item");
  }
  return [first, ...rest];
}

function toEntries(parts: ReadonlyArray<Chunk>): Array<Entry> {
  return parts.flatMap(([items, grouped]): Array<Entry> => {
    const [first, ...rest] = items;
    return first === undefined ? [] : grouped ? [group([first, ...rest])] : [...items];
  });
}

function singleStage(parts: ReadonlyArray<Chunk>): Containerfile {
  return containerfile(nonEmpty<Entry>([from("alpine"), ...toEntries(parts)]))._unsafeUnwrap();
}

function multiStage(stages: ReadonlyArray<ReadonlyArray<Chunk>>): Containerfile {
  return containerfile(
    nonEmpty<Built<Stage>>(
      stages.map((parts, i) =>
        stage(`s${i}`, nonEmpty<Entry>([from("alpine", { as: `s${i}` }), ...toEntries(parts)])),
      ),
    ),
  )._unsafeUnwrap();
}

/** Each stage's instructions with groups flattened and comments left out. */
function instructionsByStage(cf: Containerfile): Array<Array<Instruction>> {
  const flat = (entries: ReadonlyArray<Instruction | Group>) =>
    entries
      .flatMap((entry) => (entry.type === "GROUP" ? entry.instructions : [entry]))
      .filter((entry) => entry.type !== "COMMENT");
  return "stages" in cf ? cf.stages.map((s) => flat(s.instructions)) : [flat(cf.instructions)];
}

describe("parse() text fixed point", () => {
  it("renders the same text after parse(render(cf)) for a single stage", () => {
    fc.assert(
      fc.property(chunks, (parts) => {
        const text = render(singleStage(parts));

        expect(render(parse(text)._unsafeUnwrap())).toBe(text);
      }),
      { numRuns: 300 },
    );
  });

  it("renders the same text after parse(render(cf)) for several stages", () => {
    fc.assert(
      fc.property(fc.array(chunks, { minLength: 2, maxLength: 3 }), (stages) => {
        const text = render(multiStage(stages));

        expect(render(parse(text)._unsafeUnwrap())).toBe(text);
      }),
      { numRuns: 300 },
    );
  });

  it("keeps the instructions of every stage", () => {
    fc.assert(
      fc.property(fc.array(chunks, { minLength: 2, maxLength: 3 }), (stages) => {
        const original = multiStage(stages);

        // Adjacent comments join into one, so comments are left out of the comparison.
        expect(instructionsByStage(parse(render(original))._unsafeUnwrap())).toEqual(
          instructionsByStage(original),
        );
      }),
      { numRuns: 200 },
    );
  });
});
