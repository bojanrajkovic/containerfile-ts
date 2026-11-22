// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import { parse, render, type Containerfile, type ParseError } from "../src/index.js";

function parsed(text: string): Containerfile {
  return parse(text)._unsafeUnwrap();
}

function errorsOf(text: string): ReadonlyArray<ParseError> {
  return parse(text)._unsafeUnwrapErr();
}

/** Instruction types of a single-stage containerfile, with groups shown as arrays. */
function shape(cf: Containerfile): unknown {
  if (!("instructions" in cf)) {
    throw new Error("expected a single-stage containerfile");
  }
  return cf.instructions.map((entry) =>
    entry.type === "GROUP" ? entry.instructions.map((i) => i.type) : entry.type,
  );
}

describe("parse() round trip", () => {
  it("parses the example from the issue and renders it back", () => {
    const text = `FROM node:20-alpine
WORKDIR /app
RUN npm ci
CMD ["node", "index.js"]`;
    expect(render(parsed(text))).toBe(text);
  });

  it("normalizes spacing, keyword case, and CRLF line endings", () => {
    expect(render(parsed("from   node:20\r\n  run   npm ci\r\n"))).toBe("FROM node:20\nRUN npm ci");
  });
});

describe("parse() stages", () => {
  it("returns single-stage instructions for one FROM", () => {
    expect(shape(parsed("FROM a\nRUN x"))).toEqual(["FROM", "RUN"]);
  });

  it("splits stages at each FROM and names them from AS", () => {
    const cf = parsed("FROM a AS build\nRUN x\n\nFROM b\nRUN y\n\nFROM c AS final\nRUN z");

    expect("stages" in cf && cf.stages.map((s) => s.name)).toEqual(["build", "stage-1", "final"]);
  });

  it("names an unnamed first stage by its index", () => {
    const cf = parsed("FROM a\nRUN x\n\nFROM b AS two");

    expect("stages" in cf && cf.stages.map((s) => s.name)).toEqual(["stage-0", "two"]);
  });

  it("keeps content before the first FROM in the first stage", () => {
    const cf = parsed("# syntax=docker/dockerfile:1\nFROM a\n\nFROM b");

    expect("stages" in cf && cf.stages[0]?.instructions.map((i) => i.type)).toEqual([
      "COMMENT",
      "FROM",
    ]);
  });

  it("starts a stage at a comment directly above its FROM", () => {
    const cf = parsed("FROM a\nRUN x\n# runtime\nFROM b");

    expect("stages" in cf && cf.stages.map((s) => s.instructions.map((i) => i.type))).toEqual([
      ["FROM", "RUN"],
      ["COMMENT", "FROM"],
    ]);
  });

  it("leaves a comment separated from the next FROM by a blank line in the earlier stage", () => {
    const cf = parsed("FROM a\n# end\n\nFROM b");

    expect("stages" in cf && cf.stages.map((s) => s.instructions.map((i) => i.type))).toEqual([
      ["FROM", "COMMENT"],
      ["FROM"],
    ]);
  });
});

describe("parse() groups", () => {
  it("keeps one block of instructions ungrouped", () => {
    expect(shape(parsed("FROM a\nWORKDIR /app\nRUN x"))).toEqual(["FROM", "WORKDIR", "RUN"]);
  });

  it("makes each blank-line block a group when there are two or more", () => {
    const cf = parsed("FROM a\nWORKDIR /app\n\nRUN x\nRUN y\n\n\nCMD z");

    expect(shape(cf)).toEqual([["FROM", "WORKDIR"], ["RUN", "RUN"], ["CMD"]]);
    expect(
      "instructions" in cf && cf.instructions.map((e) => e.type === "GROUP" && e.comment),
    ).toEqual([null, null, null]);
  });

  it("groups per stage", () => {
    const cf = parsed("FROM a\nRUN x\n\nRUN y\n\nFROM b\nRUN z");

    expect("stages" in cf && cf.stages.map((s) => s.instructions.map((e) => e.type))).toEqual([
      ["GROUP", "GROUP"],
      ["FROM", "RUN"],
    ]);
  });

  it("renders blank lines back", () => {
    const text = "FROM a\nWORKDIR /app\n\nRUN x\n\nCMD y";
    expect(render(parsed(text))).toBe(text);
  });
});

describe("parse() comments", () => {
  it("joins consecutive comment lines into one comment", () => {
    const cf = parsed("# one\n# two\n#\n#  three\nFROM a");

    expect("instructions" in cf && cf.instructions[0]).toEqual({
      type: "COMMENT",
      lines: ["one", "two", "", " three"],
    });
  });

  it("adds the missing space after the hash on render", () => {
    expect(render(parsed("#note\nFROM a"))).toBe("# note\nFROM a");
  });

  it("moves a comment inside a continued instruction above that instruction", () => {
    const cf = parsed("FROM a\nRUN one \\\n  # inner\n  && two");

    expect(shape(cf)).toEqual(["FROM", "COMMENT", "RUN"]);
    expect("instructions" in cf && cf.instructions[2]).toMatchObject({
      command: "one \\\n  && two",
    });
  });

  it("keeps a syntax directive as a comment", () => {
    expect(render(parsed("# syntax=docker/dockerfile:1\nFROM a"))).toBe(
      "# syntax=docker/dockerfile:1\nFROM a",
    );
  });

  it("accepts a comment-only file", () => {
    expect(shape(parsed("# nothing here"))).toEqual(["COMMENT"]);
  });
});

describe("parse() instructions", () => {
  it("reads RUN, CMD, and ENTRYPOINT as exec form only when the text is a JSON string array", () => {
    const cf = parsed(
      `FROM a\nRUN ["a", "b c"]\nCMD ['a','b']\nENTRYPOINT ["x"]\nCMD [1, 2]\nRUN [ -f /x ] && echo ok`,
    );

    expect("instructions" in cf && cf.instructions.slice(1)).toMatchObject([
      { type: "RUN", command: ["a", "b c"] },
      { type: "CMD", command: "['a','b']" },
      { type: "ENTRYPOINT", command: ["x"] },
      { type: "CMD", command: "[1, 2]" },
      { type: "RUN", command: "[ -f /x ] && echo ok" },
    ]);
  });

  it("reads exec form that continues over lines", () => {
    const cf = parsed('FROM a\nRUN ["a", \\\n  "b"]');

    expect("instructions" in cf && cf.instructions[1]).toMatchObject({ command: ["a", "b"] });
  });

  it("keeps shell-form continuations as written", () => {
    const cf = parsed("FROM a\nRUN apt-get update && \\\n    apt-get install -y curl");

    expect("instructions" in cf && cf.instructions[1]).toMatchObject({
      command: "apt-get update && \\\n    apt-get install -y curl",
    });
  });

  it("ends an instruction at a line that ends in an escaped backslash", () => {
    // dockerfile-ast would continue the RUN onto the next line. BuildKit doesn't.
    const cf = parsed("FROM a\nRUN echo a\\\\\nRUN y");

    expect(shape(cf)).toEqual(["FROM", "RUN", "RUN"]);
    expect("instructions" in cf && cf.instructions[1]).toMatchObject({ command: "echo a\\\\" });
  });

  it("reads FROM with AS in any case", () => {
    expect(parsed("FROM node:20 as build")).toEqual({
      instructions: [{ type: "FROM", image: "node:20", as: "build", platform: null }],
    });
  });

  it("reads WORKDIR as the rest of the line", () => {
    expect(parsed("FROM a\nWORKDIR /my app")).toMatchObject({
      instructions: [{}, { type: "WORKDIR", path: "/my app" }],
    });
  });

  it("reads USER with and without a group", () => {
    expect(parsed("FROM a\nUSER app\nUSER app:grp")).toMatchObject({
      instructions: [{}, { user: "app", group: null }, { user: "app", group: "grp" }],
    });
  });

  it("reads VOLUME in JSON and word form, honoring quotes", () => {
    expect(parsed('FROM a\nVOLUME ["/a", "/b"]\nVOLUME /c "/d e" \'/f\'')).toMatchObject({
      instructions: [{}, { paths: ["/a", "/b"] }, { paths: ["/c", "/d e", "/f"] }],
    });
  });

  it("splits EXPOSE into one instruction per port", () => {
    expect(parsed("FROM a\nEXPOSE 80 443/tcp 8000-8010/udp 53/UDP")).toMatchObject({
      instructions: [
        {},
        { ports: 80, protocol: null },
        { ports: 443, protocol: "tcp" },
        { ports: { start: 8000, end: 8010 }, protocol: "udp" },
        { ports: 53, protocol: "udp" },
      ],
    });
  });

  it("reads SHELL", () => {
    expect(parsed('FROM a\nSHELL ["/bin/bash", "-c"]')).toMatchObject({
      instructions: [{}, { type: "SHELL", command: ["/bin/bash", "-c"] }],
    });
  });
});

describe("parse() errors", () => {
  it.each<[string, string, { line: number; field: string; message?: string; value?: unknown }]>([
    [
      "an unsupported instruction",
      "FROM a\nENV A=1",
      { line: 2, field: "instruction", message: "ENV isn't supported", value: "ENV" },
    ],
    [
      "an unknown instruction",
      "FROM a\nFOO bar",
      { line: 2, field: "instruction", message: "FOO isn't supported" },
    ],
    [
      "ONBUILD",
      "FROM a\nONBUILD RUN x",
      { line: 2, field: "instruction", message: "ONBUILD isn't supported" },
    ],
    [
      "a FROM flag",
      "FROM --platform=linux/amd64 a",
      {
        line: 1,
        field: "flag",
        message: "FROM --platform isn't supported",
        value: "--platform=linux/amd64",
      },
    ],
    [
      "a RUN flag",
      "FROM a\nRUN --mount=type=cache,target=/c x",
      { line: 2, field: "flag", message: "RUN --mount isn't supported" },
    ],
    [
      "a RUN heredoc",
      "FROM a\nRUN <<EOF\nx\nEOF",
      { line: 2, field: "heredoc", message: "RUN heredocs aren't supported" },
    ],
    [
      "a backtick escape directive",
      "# escape=`\nFROM a",
      { line: 1, field: "directive", message: "# escape=` isn't supported", value: "`" },
    ],
    [
      "an escape= comment after the first instruction",
      "FROM a\n# escape=x",
      { line: 2, field: "lines[0]", message: "escape= parser directive" },
    ],
    [
      "an empty file",
      "",
      { line: 1, field: "text", message: "must contain at least one instruction or comment" },
    ],
    ["a blank file", "\n  \n", { line: 1, field: "text" }],
    [
      "FROM without an image",
      "FROM",
      { line: 1, field: "arguments", message: "FROM takes an image and an optional AS name" },
    ],
    ["FROM with extra words", "FROM a b c", { line: 1, field: "arguments" }],
    ["an invalid image", "FROM Not_An_Image!", { line: 1, field: "image" }],
    [
      "USER with two words",
      "FROM a\nUSER a b",
      { line: 2, field: "arguments", message: "USER takes one argument" },
    ],
    ["WORKDIR without a path", "FROM a\nWORKDIR", { line: 2, field: "path" }],
    [
      "an unterminated quote",
      'FROM a\nVOLUME "/a',
      { line: 2, field: "arguments", message: "unterminated double quote" },
    ],
    ["a port out of range", "FROM a\nEXPOSE 99999", { line: 2, field: "port", value: 99999 }],
    ["a port variable", "FROM a\nEXPOSE $PORT", { line: 2, field: "ports", value: "$PORT" }],
    ["a reversed port range", "FROM a\nEXPOSE 90-80", { line: 2, field: "port" }],
    [
      "SHELL in shell form",
      "FROM a\nSHELL /bin/sh -c",
      { line: 2, field: "command", message: "SHELL takes a JSON array of strings" },
    ],
    ["an empty exec array", "FROM a\nCMD []", { line: 2, field: "command" }],
  ])("rejects %s", (_name, text, expected) => {
    expect(errorsOf(text)).toMatchObject([
      {
        ...expected,
        message: expect.stringContaining(expected.message ?? ""),
      },
    ]);
  });

  it("collects every error with its own line", () => {
    expect(errorsOf("ENV A=1\nFOO\nFROM --x a")).toMatchObject([
      { line: 1, field: "instruction" },
      { line: 2, field: "instruction" },
      { line: 3, field: "flag" },
    ]);
  });

  it("counts lines of continued instructions", () => {
    expect(errorsOf("FROM a\nRUN a \\\n  b\n\nENV X=1")).toMatchObject([{ line: 5 }]);
  });

  it("reports an escape directive alone, since later lines would parse wrongly", () => {
    expect(errorsOf("# escape=`\nENV A=1\nFROM a")).toMatchObject([{ field: "directive" }]);
  });

  it("drops an explicit backslash escape directive, which is the default", () => {
    expect(render(parsed("# escape=\\\nFROM a"))).toBe("FROM a");
  });
});
