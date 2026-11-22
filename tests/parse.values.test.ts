// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  parse,
  render,
  type Containerfile,
  type Instruction,
  type ParseError,
} from "../src/index.js";

function parsed(text: string): Containerfile {
  return parse(text)._unsafeUnwrap();
}

/** The instructions after the FROM of a single-stage Dockerfile. */
function after(text: string): ReadonlyArray<Instruction> {
  const cf = parsed(`FROM a\n${text}`);
  if (!("instructions" in cf)) {
    throw new Error("expected a single-stage containerfile");
  }
  return cf.instructions.slice(1).map((entry) => {
    if (entry.type === "GROUP") {
      throw new Error("expected no groups");
    }
    return entry;
  });
}

function errorsOf(text: string): ReadonlyArray<ParseError> {
  return parse(text)._unsafeUnwrapErr();
}

describe("parse() ENV", () => {
  it.each<[string, string, { text: string; expand: boolean }]>([
    ["a quoted value", 'ENV A="x y"', { text: "x y", expand: false }],
    ["a single-quoted value", "ENV A='x y'", { text: "x y", expand: false }],
    ["an unquoted value", "ENV A=x", { text: "x", expand: false }],
    ["an empty value", "ENV A=", { text: "", expand: false }],
    ["an empty quoted value", 'ENV A=""', { text: "", expand: false }],
    ["a variable", "ENV A=$B", { text: "$B", expand: true }],
    ["a braced variable in quotes", 'ENV A="${B}-x"', { text: "${B}-x", expand: true }],
    ["an escaped dollar", "ENV A=\\$B", { text: "$B", expand: false }],
    ["an escaped dollar in quotes", 'ENV A="\\$B"', { text: "$B", expand: false }],
    ["a dollar in single quotes", "ENV A='$B'", { text: "$B", expand: false }],
    ["a dollar before a quote, which is literal", "ENV A=$'b'", { text: "$b", expand: false }],
    ["a braced variable before an escape", "ENV A=${B}\\c", { text: "${B}c", expand: true }],
    [
      "an escaped quote and backslash in quotes",
      'ENV A="a\\"b\\\\c"',
      { text: 'a"b\\c', expand: false },
    ],
    [
      "a backslash that escapes nothing in quotes",
      'ENV A="a\\qb"',
      { text: "a\\qb", expand: false },
    ],
    ["an escaped space outside quotes", "ENV A=a\\ b", { text: "a b", expand: false }],
    ["quotes joined to plain text", "ENV A=a\"b c\"'d e'f", { text: "ab cd ef", expand: false }],
    ["the legacy form", "ENV A b   c", { text: "b   c", expand: false }],
    ["the legacy form with quotes", 'ENV A "b c"', { text: "b c", expand: false }],
    ["the legacy form with a variable", "ENV A $B c", { text: "$B c", expand: true }],
  ])("reads %s", (_name, text, value) => {
    expect(after(text)).toMatchObject([{ type: "ENV", key: "A", value }]);
  });

  it("splits several pairs into one ENV each, in order", () => {
    expect(after('ENV A=1 B="2 3" C=')).toMatchObject([
      { type: "ENV", key: "A", value: { text: "1" } },
      { type: "ENV", key: "B", value: { text: "2 3" } },
      { type: "ENV", key: "C", value: { text: "" } },
    ]);
  });

  it("reads pairs that continue over lines", () => {
    expect(after("ENV A=1 \\\n    B=2")).toMatchObject([{ key: "A" }, { key: "B" }]);
  });

  it("accepts several pairs when no value expands", () => {
    expect(after("ENV A=\\$x B='$y'")).toMatchObject([{ key: "A" }, { key: "B" }]);
  });

  it("renders back as one quoted ENV per pair", () => {
    expect(render(parsed("FROM a\nENV A=1 B='x y'"))).toBe('FROM a\nENV A="1"\nENV B="x y"');
  });
});

describe("parse() LABEL", () => {
  it("reads pairs, quoted values, dotted keys, and the legacy form", () => {
    expect(after('LABEL a=b org.example.key="c d"\nLABEL legacy some value')).toMatchObject([
      { type: "LABEL", key: "a", value: { text: "b", expand: false } },
      { type: "LABEL", key: "org.example.key", value: { text: "c d" } },
      { type: "LABEL", key: "legacy", value: { text: "some value" } },
    ]);
  });

  it("marks a variable as expanding", () => {
    expect(after("LABEL v=$VERSION")).toMatchObject([
      { value: { text: "$VERSION", expand: true } },
    ]);
  });

  it("splits pairs even when a value expands", () => {
    expect(after("LABEL a=1 b=$a")).toMatchObject([{ key: "a" }, { key: "b" }]);
  });
});

describe("parse() ARG", () => {
  it("reads a name with and without a default", () => {
    expect(after('ARG V=1\nARG W\nARG X="a b"\nARG Y=')).toMatchObject([
      { type: "ARG", name: "V", defaultValue: { text: "1", expand: false } },
      { type: "ARG", name: "W", defaultValue: null },
      { type: "ARG", name: "X", defaultValue: { text: "a b" } },
      { type: "ARG", name: "Y", defaultValue: { text: "" } },
    ]);
  });

  it("marks a default that uses a variable as expanding", () => {
    expect(after("ARG A=$B")).toMatchObject([{ defaultValue: { text: "$B", expand: true } }]);
  });

  it("splits several names and pairs into one ARG each", () => {
    expect(after("ARG A=1 B C='x y'")).toMatchObject([
      { name: "A", defaultValue: { text: "1" } },
      { name: "B", defaultValue: null },
      { name: "C", defaultValue: { text: "x y" } },
    ]);
  });

  it("stays global before the first FROM", () => {
    expect(render(parsed("ARG V=20\nFROM node:${V}"))).toBe('ARG V="20"\nFROM node:${V}');
  });
});

describe("parse() COPY and ADD", () => {
  it("reads sources and a destination in word form", () => {
    expect(after("COPY a b /d/")).toMatchObject([
      { type: "COPY", src: ["a", "b"], dest: "/d/", from: null, chown: null, chmod: null },
    ]);
  });

  it("removes quotes from words", () => {
    expect(after("COPY \"a\" 'c'd /d")).toMatchObject([{ src: ["a", "cd"], dest: "/d" }]);
  });

  it("reads JSON form", () => {
    expect(after('COPY ["a", "/d/"]')).toMatchObject([{ src: ["a"], dest: "/d/" }]);
  });

  it("reads JSON form that continues over lines", () => {
    expect(after('COPY ["a", \\\n  "/d/"]')).toMatchObject([{ src: ["a"], dest: "/d/" }]);
  });

  it("treats text that isn't a JSON array as words", () => {
    expect(after("COPY [a] /d")).toMatchObject([{ src: ["[a]"], dest: "/d" }]);
  });

  it("reads every COPY flag", () => {
    expect(after("COPY --from=build --chown=1:2 --chmod=755 a /d")).toMatchObject([
      { from: "build", chown: "1:2", chmod: "755", src: ["a"], dest: "/d" },
    ]);
  });

  it("reads ADD with flags and a URL", () => {
    expect(after("ADD --chown=app:app --chmod=644 https://example.com/f.tar.gz /d/")).toMatchObject(
      [
        {
          type: "ADD",
          src: ["https://example.com/f.tar.gz"],
          dest: "/d/",
          chown: "app:app",
          chmod: "644",
        },
      ],
    );
  });

  it("reads flags that continue over lines", () => {
    expect(after("COPY --chown=1:2 \\\n  a /d")).toMatchObject([{ chown: "1:2", src: ["a"] }]);
  });

  it("takes a flag-like word after the first path as a path, as BuildKit does", () => {
    expect(after("COPY a --chown=1:2 /d")).toMatchObject([
      { src: ["a", "--chown=1:2"], chown: null },
    ]);
  });
});

describe("parse() FROM --platform", () => {
  it("reads the platform", () => {
    expect(parsed("FROM --platform=linux/amd64 node:20 AS build")).toEqual({
      instructions: [{ type: "FROM", image: "node:20", as: "build", platform: "linux/amd64" }],
    });
  });

  it("keeps a variable platform", () => {
    expect(parsed("FROM --platform=$BUILDPLATFORM node")).toMatchObject({
      instructions: [{ platform: "$BUILDPLATFORM" }],
    });
  });
});

describe("parse() HEALTHCHECK", () => {
  it("reads NONE in any case", () => {
    expect(after("HEALTHCHECK none")).toEqual([{ type: "HEALTHCHECK", check: "NONE" }]);
  });

  it("reads a shell-form CMD", () => {
    expect(after("HEALTHCHECK CMD curl -f http://localhost/ || exit 1")).toMatchObject([
      {
        check: "CMD",
        command: "curl -f http://localhost/ || exit 1",
        interval: null,
        timeout: null,
        startPeriod: null,
        startInterval: null,
        retries: null,
      },
    ]);
  });

  it("reads an exec-form CMD", () => {
    expect(after('HEALTHCHECK CMD ["curl", "-f", "/"]')).toMatchObject([
      { command: ["curl", "-f", "/"] },
    ]);
  });

  it("reads every flag, writing durations the way the factory does", () => {
    expect(
      after(
        "HEALTHCHECK --interval=90s --timeout=5s --start-period=1m --start-interval=500ms --retries=3 CMD true",
      ),
    ).toMatchObject([
      { interval: "1m30s", timeout: "5s", startPeriod: "1m0s", startInterval: "500ms", retries: 3 },
    ]);
  });

  it("joins a continued shell command", () => {
    expect(after("HEALTHCHECK CMD a && \\\n  b")).toMatchObject([{ command: "a &&   b" }]);
  });

  it("reads flags that continue over lines", () => {
    expect(after("HEALTHCHECK --interval=5s \\\n  CMD true")).toMatchObject([
      { interval: "5s", command: "true" },
    ]);
  });
});

describe("parse() errors for values and flags", () => {
  it.each<[string, string, { line: number; field: string; message: string; value?: unknown }]>([
    ["ENV without a value", "FROM a\nENV A", { line: 2, field: "arguments", message: "ENV A" }],
    ["ENV with no arguments", "FROM a\nENV", { line: 2, field: "arguments", message: "ENV takes" }],
    [
      "ENV with several pairs where a value expands",
      "FROM a\nENV A=1 B=$A",
      { line: 2, field: "arguments", message: "can't use a variable" },
    ],
    [
      "a value that mixes an expanding and a literal dollar",
      "FROM a\nENV A=$B\\$C",
      { line: 2, field: "arguments", message: "mixes" },
    ],
    [
      "a literal dollar next to an expanding one, in single quotes",
      "FROM a\nLABEL a='$x'$y",
      { line: 2, field: "arguments", message: "mixes" },
    ],
    [
      "an unterminated quote",
      'FROM a\nENV A="b',
      { line: 2, field: "arguments", message: "unterminated" },
    ],
    [
      "a pair with no equals sign after one with",
      "FROM a\nENV A=1 B",
      { line: 2, field: "arguments", message: "B" },
    ],
    ["a key with a space", 'FROM a\nENV "a b"=c', { line: 2, field: "key", message: "" }],
    ["ARG with no name", "FROM a\nARG", { line: 2, field: "arguments", message: "ARG takes" }],
    ["ARG with an empty name", "FROM a\nARG =x", { line: 2, field: "name", message: "" }],
    [
      "LABEL without a value",
      "FROM a\nLABEL a",
      { line: 2, field: "arguments", message: "LABEL a" },
    ],
    [
      "COPY with only one word",
      "FROM a\nCOPY a",
      { line: 2, field: "arguments", message: "COPY takes" },
    ],
    [
      "a COPY path with a space, quoted",
      'FROM a\nCOPY "a b" /d',
      { line: 2, field: "arguments", message: "whitespace" },
    ],
    [
      "a COPY path with a space, in JSON form",
      'FROM a\nCOPY ["a", "/d d/"]',
      { line: 2, field: "arguments", message: "whitespace" },
    ],
    [
      "an ADD path with a space",
      'FROM a\nADD ["a b", "/d"]',
      { line: 2, field: "arguments", message: "whitespace" },
    ],
    ["ADD with no words", "FROM a\nADD", { line: 2, field: "arguments", message: "ADD takes" }],
    [
      "COPY with an unterminated quote",
      'FROM a\nCOPY "a /d',
      { line: 2, field: "arguments", message: "unterminated" },
    ],
    [
      "COPY --link",
      "FROM a\nCOPY --link a /d",
      { line: 2, field: "flag", message: "COPY --link isn't supported", value: "--link" },
    ],
    [
      "ADD --from",
      "FROM a\nADD --from=x a /d",
      { line: 2, field: "flag", message: "ADD --from isn't supported" },
    ],
    [
      "FROM --chown",
      "FROM --chown=a b",
      { line: 1, field: "flag", message: "FROM --chown isn't supported" },
    ],
    [
      "a duplicate flag",
      "FROM a\nCOPY --chown=a --chown=b a /d",
      { line: 2, field: "flag", message: "more than once", value: "--chown=b" },
    ],
    [
      "a flag with a value after a space",
      "FROM a\nCOPY --chown app:app a /d",
      { line: 2, field: "flag", message: "--chown=value", value: "--chown" },
    ],
    [
      "a quoted flag value",
      'FROM a\nCOPY --chown="a b" a /d',
      { line: 2, field: "flag", message: "quotes", value: '--chown="a' },
    ],
    [
      "a COPY heredoc",
      "FROM a\nCOPY <<EOF /d\nx\nEOF",
      { line: 2, field: "heredoc", message: "COPY heredocs aren't supported" },
    ],
    [
      "an ADD heredoc",
      "FROM a\nADD <<EOF /d\nx\nEOF",
      { line: 2, field: "heredoc", message: "ADD heredocs aren't supported" },
    ],
    [
      "HEALTHCHECK with nothing after it",
      "FROM a\nHEALTHCHECK",
      { line: 2, field: "arguments", message: "HEALTHCHECK takes" },
    ],
    [
      "HEALTHCHECK with an unknown word",
      "FROM a\nHEALTHCHECK foo",
      { line: 2, field: "arguments", message: "HEALTHCHECK takes" },
    ],
    [
      "HEALTHCHECK NONE with more words",
      "FROM a\nHEALTHCHECK NONE x",
      { line: 2, field: "arguments", message: "NONE takes no" },
    ],
    [
      "HEALTHCHECK NONE with a flag",
      "FROM a\nHEALTHCHECK --interval=1s NONE",
      { line: 2, field: "arguments", message: "NONE takes no" },
    ],
    [
      "HEALTHCHECK CMD with no command",
      "FROM a\nHEALTHCHECK CMD",
      { line: 2, field: "command", message: "" },
    ],
    [
      "a day duration",
      "FROM a\nHEALTHCHECK --interval=1d CMD true",
      { line: 2, field: "flag", message: "--interval" },
    ],
    [
      "a negative duration",
      "FROM a\nHEALTHCHECK --timeout=-5s CMD true",
      { line: 2, field: "timeout", message: "" },
    ],
    [
      "a duration with no unit",
      "FROM a\nHEALTHCHECK --interval=30 CMD true",
      { line: 2, field: "flag", message: "--interval" },
    ],
    [
      "retries that isn't a number",
      "FROM a\nHEALTHCHECK --retries=x CMD true",
      { line: 2, field: "flag", message: "--retries" },
    ],
    [
      "retries below one",
      "FROM a\nHEALTHCHECK --retries=0 CMD true",
      { line: 2, field: "retries", message: "" },
    ],
    [
      "a HEALTHCHECK flag it doesn't have",
      "FROM a\nHEALTHCHECK --foo=1 CMD true",
      { line: 2, field: "flag", message: "HEALTHCHECK --foo isn't supported" },
    ],
  ])("rejects %s", (_name, text, expected) => {
    expect(errorsOf(text)).toMatchObject([
      { ...expected, message: expect.stringContaining(expected.message) },
    ]);
  });

  it("reports each bad pair of a multi-pair ENV", () => {
    expect(errorsOf('FROM a\nENV "a b"=1 "c d"=2').map((e) => e.field)).toEqual(["key", "key"]);
  });

  it("reports every flag problem of one instruction", () => {
    expect(errorsOf("FROM a\nCOPY --link --chown a /d").map((e) => e.value)).toEqual([
      "--link",
      "--chown",
    ]);
  });

  it("still rejects other RUN flags and instructions the model has no type for", () => {
    expect(errorsOf("FROM a\nRUN --network=none x\nSTOPSIGNAL SIGTERM")).toMatchObject([
      { line: 2, field: "flag" },
      { line: 3, field: "instruction", message: "STOPSIGNAL isn't supported" },
    ]);
  });
});
