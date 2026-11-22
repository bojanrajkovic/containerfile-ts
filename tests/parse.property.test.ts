// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { Result } from "neverthrow";
import {
  add,
  arg,
  cmd,
  comment,
  containerfile,
  copy,
  entrypoint,
  env,
  expose,
  from,
  group,
  healthcheck,
  healthcheckNone,
  heredoc,
  label,
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
  type MountOptions,
  type NonEmptyArray,
  type Stage,
  type ValidationError,
} from "../src/index.js";

type Built<T> = Result<T, Array<ValidationError>>;
type Entry = Built<Instruction | Group>;
type Chunk = readonly [ReadonlyArray<Built<Instruction>>, boolean];

const word = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const words = fc.array(word, { minLength: 1, maxLength: 3 });

// Characters a value can hold that quoting and escaping have to get right.
const plain = fc.string({
  unit: fc.constantFrom("a", "b", " ", '"', "'", "\\", "{", "}", "=", "#"),
  maxLength: 6,
});

// Either every `$` is text, or the value expands a real variable. A lone `$`, like a trailing
// one, isn't a variable to BuildKit, so it parses back as text.
const quoted = fc.oneof(
  plain.map((text) => ({ text, expand: false })),
  fc.tuple(plain, plain).map(([a, b]) => ({ text: a + "$" + b, expand: false })),
  fc
    .tuple(plain, fc.constantFrom("$a", "${b}"), plain)
    .map(([a, variable, b]) => ({ text: a + variable + b, expand: true })),
);

const path = word.map((w) => `/${w}`);
const maybe = <T>(arbitrary: fc.Arbitrary<T>) => fc.option(arbitrary, { nil: undefined });
const mode = maybe(fc.integer({ min: 0, max: 0o7777 }));
const owner = maybe(fc.integer({ min: 0, max: 65535 }));

const mountOptions: fc.Arbitrary<MountOptions> = fc.oneof(
  fc.record({
    type: fc.constant("bind" as const),
    target: path,
    source: maybe(path),
    from: maybe(word),
    readwrite: fc.boolean(),
  }),
  fc.record({
    type: fc.constant("cache" as const),
    target: path,
    id: maybe(word),
    sharing: maybe(fc.constantFrom("shared" as const, "private" as const, "locked" as const)),
    from: maybe(word),
    source: maybe(path),
    mode,
    uid: owner,
    gid: owner,
    readonly: fc.boolean(),
  }),
  fc.record({
    type: fc.constant("tmpfs" as const),
    target: path,
    size: maybe(fc.constantFrom("64m", "1g", "1024")),
  }),
  fc.record({
    type: fc.constant("secret" as const),
    id: word,
    target: maybe(path),
    env: maybe(fc.constantFrom("TOKEN", "A_B")),
    required: fc.boolean(),
    mode,
    uid: owner,
    gid: owner,
  }),
  fc.record({
    type: fc.constant("ssh" as const),
    id: maybe(word),
    target: maybe(path),
    required: fc.boolean(),
    mode,
    uid: owner,
    gid: owner,
  }),
);
const mounts = fc.array(mountOptions, { maxLength: 3 });

// Lines a script can hold that the parser must not mistake for Dockerfile text.
const scriptLine = fc.oneof(
  fc.string({ unit: fc.constantFrom("a", " ", "#", "\\", "<", "'", "$", "F"), maxLength: 8 }),
  fc.constantFrom("FROM x", "# note", "", "RUN y", "EOF", "<<'EOF'"),
);

const seconds = fc.option(fc.integer({ min: 1, max: 5000 }), { nil: undefined });
const duration = seconds.map((n) =>
  n === undefined ? undefined : Temporal.Duration.from({ seconds: n }),
);

// Only instructions parse() reads.
const instruction: fc.Arbitrary<Built<Instruction>> = fc
  .oneof(
    quoted.map(({ text, expand }) => env("K", text, { expand })),
    quoted.map(({ text, expand }) => label("org.example.k", text, { expand })),
    fc
      .option(quoted, { nil: null })
      .map((value) =>
        value === null ? arg("V") : arg("V", { defaultValue: value.text, expand: value.expand }),
      ),
    fc
      .tuple(words, word, fc.option(word, { nil: undefined }), fc.option(word, { nil: undefined }))
      .map(([srcs, dest, from_, chown]) => copy(srcs, `/${dest}`, { from: from_, chown })),
    fc.tuple(words, word).map(([srcs, dest]) => add(srcs, `/${dest}`, { chmod: "644" })),
    fc.constant(healthcheckNone()),
    fc
      .tuple(
        words,
        duration,
        duration,
        fc.option(fc.integer({ min: 1, max: 9 }), { nil: undefined }),
      )
      .map(([ws, interval, timeout, retries]) => healthcheck(ws, { interval, timeout, retries })),
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
    fc.tuple(words, mounts).map(([ws, list]) => run(ws, { mounts: list })),
    fc.tuple(words, mounts).map(([ws, list]) => run(ws.join(" "), { mounts: list })),
    fc
      .tuple(fc.array(scriptLine, { minLength: 1, maxLength: 4 }), maybe(word), mounts)
      .map(([lines, interpreter, list]) =>
        run(heredoc(nonEmpty(lines), { interpreter }), { mounts: list }),
      ),
    fc.constant(shell(["/bin/sh", "-c"])),
    words.map(([first, ...rest]) => comment(first ?? "x", ...rest)),
    // The factories reject some values, such as one ending in a backslash.
  )
  .filter((built) => built.isOk());

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
