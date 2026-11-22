// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  heredoc,
  parse,
  render,
  type Containerfile,
  type Instruction,
  type ParseError,
  type RunInstruction,
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

function runOf(text: string): RunInstruction {
  // A comment inside a continued RUN comes out above it, so look for the RUN itself.
  const instruction = after(text).find((entry) => entry.type === "RUN");
  if (instruction === undefined) {
    throw new Error("expected a RUN");
  }
  return instruction;
}

function errorsOf(text: string): ReadonlyArray<ParseError> {
  return parse(text)._unsafeUnwrapErr();
}

describe("parse() RUN --mount", () => {
  it.each<[string, string, unknown]>([
    [
      "a cache mount",
      "--mount=type=cache,target=/c,id=npm,sharing=locked",
      { type: "cache", target: "/c", id: "npm", sharing: "locked", readonly: false },
    ],
    [
      "a bind mount, which is the default type and read-only",
      "--mount=source=.,target=/src",
      { type: "bind", source: ".", target: "/src", readwrite: false },
    ],
    [
      "a read-write bind mount",
      "--mount=type=bind,target=/s,rw",
      { type: "bind", readwrite: true },
    ],
    [
      "a read-write bind mount spelled readwrite=true",
      "--mount=type=bind,target=/s,readwrite=true",
      { type: "bind", readwrite: true },
    ],
    [
      "a read-write bind mount spelled ro=false",
      "--mount=type=bind,target=/s,ro=false",
      { type: "bind", readwrite: true },
    ],
    [
      "an explicit read-only bind mount",
      "--mount=type=bind,target=/s,readonly",
      { type: "bind", readwrite: false },
    ],
    [
      "a read-only cache mount",
      "--mount=type=cache,target=/c,ro",
      { type: "cache", readonly: true },
    ],
    [
      "a read-only cache mount spelled rw=false",
      "--mount=type=cache,target=/c,rw=false",
      { type: "cache", readonly: true },
    ],
    [
      "the alternate names src, dst, and destination",
      "--mount=type=bind,src=/a,destination=/b",
      { type: "bind", source: "/a", target: "/b" },
    ],
    [
      "keys and the type in any case",
      "--mount=TYPE=Cache,Target=/c,Sharing=LOCKED,ID=Npm",
      { type: "cache", target: "/c", sharing: "locked", id: "Npm" },
    ],
    ["a tmpfs mount", "--mount=type=tmpfs,target=/t,size=64m", { type: "tmpfs", size: "64m" }],
    [
      "a secret mount",
      "--mount=type=secret,id=npmrc,target=/root/.npmrc,env=TOKEN,required",
      { type: "secret", id: "npmrc", target: "/root/.npmrc", env: "TOKEN", required: true },
    ],
    [
      "required spelled out",
      "--mount=type=secret,id=x,required=false",
      { type: "secret", required: false },
    ],
    [
      "mode as octal, with uid and gid",
      "--mount=type=cache,target=/c,mode=0755,uid=1000,gid=1001",
      { type: "cache", mode: 0o755, uid: 1000, gid: 1001 },
    ],
    [
      "an ssh mount",
      "--mount=type=ssh,id=default,required",
      { type: "ssh", id: "default", required: true },
    ],
  ])("reads %s", (_name, flag, mount) => {
    expect(runOf(`RUN ${flag} true`).mounts).toMatchObject([mount]);
  });

  it("keeps several mounts in order, over lines and around comments", () => {
    const run = runOf(
      "RUN --mount=type=tmpfs,target=/a \\\n  # note\n  --mount=type=tmpfs,target=/b --mount=type=tmpfs,target=/c \\\n  npm ci",
    );

    expect(run.command).toBe("npm ci");
    expect(run.mounts).toMatchObject([{ target: "/a" }, { target: "/b" }, { target: "/c" }]);
  });

  it("goes before exec form too", () => {
    const run = runOf('RUN --mount=type=tmpfs,target=/t ["npm", "ci"]');

    expect(run.command).toEqual(["npm", "ci"]);
    expect(run.mounts).toHaveLength(1);
  });

  it("renders back with the canonical names, order, and type", () => {
    expect(render(parsed("FROM a\nRUN --mount=SRC=.,DST=/src,RW  true"))).toBe(
      "FROM a\nRUN --mount=type=bind,source=.,target=/src,rw true",
    );
  });

  it.each<[string, string, string, string]>([
    ["an unknown key", "--mount=type=cache,target=/c,foo=1", "flag", "foo"],
    ["a bare unknown key", "--mount=type=cache,target=/c,foo", "flag", "foo"],
    ["an unknown type", "--mount=type=volume,target=/c", "flag", "volume"],
    ["an empty field", "--mount=type=cache,,target=/c", "flag", "empty"],
    ["a repeated key", "--mount=type=cache,target=/a,target=/b", "flag", "more than once"],
    ["both spellings of one key", "--mount=type=cache,target=/a,dst=/b", "flag", "more than once"],
    ["size on a cache mount", "--mount=type=cache,target=/c,size=1m", "flag", "size"],
    ["sharing on a bind mount", "--mount=type=bind,target=/c,sharing=locked", "flag", "sharing"],
    ["required on a cache mount", "--mount=type=cache,target=/c,required", "flag", "required"],
    ["mode on a bind mount", "--mount=type=bind,target=/c,mode=0755", "flag", "mode"],
    ["ro on a tmpfs mount", "--mount=type=tmpfs,target=/c,ro", "flag", "ro"],
    ["rw on a secret mount", "--mount=type=secret,id=x,rw", "flag", "rw"],
    ["source on a secret mount", "--mount=type=secret,id=x,source=/s", "flag", "source"],
    ["a cache mount without a target", "--mount=type=cache,id=x", "flag", "target"],
    ["a non-numeric uid", "--mount=type=cache,target=/c,uid=abc", "flag", "uid"],
    ["a mode that isn't octal", "--mount=type=cache,target=/c,mode=789", "flag", "mode"],
    ["an unknown sharing mode", "--mount=type=cache,target=/c,sharing=x", "flag", "sharing"],
    ["a boolean that isn't one", "--mount=type=secret,id=x,required=maybe", "flag", "required"],
    ["quotes", '--mount=type=cache,"target=/c"', "flag", "quotes"],
    ["a flag with no value", "--mount", "flag", "--mount"],
    ["the space form", "--mount type=cache,target=/c", "flag", "--mount"],
    ["another flag", "--network=none", "flag", "--network"],
  ])("rejects %s", (_name, flag, field, message) => {
    const [error, ...rest] = errorsOf(`FROM a\nRUN ${flag} true`);

    expect(rest).toEqual([]);
    expect(error).toMatchObject({ line: 2, field });
    expect(error?.message).toContain(message);
  });

  it.each<[string, string, string]>([
    ["a secret with no id or target", "--mount=type=secret,required", "mounts[0]"],
    ["a uid over 32 bits", "--mount=type=cache,target=/c,uid=99999999999", "mounts[0].uid"],
    ["a mode over 07777", "--mount=type=cache,target=/c,mode=77777", "mounts[0].mode"],
    ["an empty id", "--mount=type=cache,target=/c,id=", "mounts[0].id"],
    ["a variable in from", "--mount=type=bind,target=/c,from=$S", "mounts[0].from"],
  ])("passes on the factory's error for %s", (_name, flag, field) => {
    expect(errorsOf(`FROM a\nRUN ${flag} true`)).toMatchObject([{ line: 2, field }]);
  });

  it("numbers the mounts in the factory's error fields", () => {
    expect(
      errorsOf("FROM a\nRUN --mount=type=tmpfs,target=/a --mount=type=cache,target=/c,id= true"),
    ).toMatchObject([{ field: "mounts[1].id" }]);
  });

  it("rejects a flag that a line continuation splits, which would cut the command wrong", () => {
    expect(errorsOf("FROM a\nRUN --mount=type=cache,target=/a\\\n,id=x true")).toMatchObject([
      { line: 2, field: "arguments", message: "a flag can't run into a line continuation" },
    ]);
  });

  it("reports every bad mount", () => {
    expect(
      errorsOf("FROM a\nRUN --mount=type=cache --mount=type=volume,target=/c true"),
    ).toHaveLength(2);
  });
});

describe("parse() RUN heredocs", () => {
  it.each<[string, string, string | null]>([
    ["single quotes", "<<'EOF'", null],
    ["double quotes", '<<"EOF"', null],
    ["an interpreter", "python3 <<'EOF'", "python3"],
    ["an interpreter with arguments", "bash -ex <<'EOF'", "bash -ex"],
    ["a command that reads the script", "cat > /out <<'EOF'", "cat > /out"],
  ])("reads a heredoc with %s", (_name, start, interpreter) => {
    const run = runOf(`RUN ${start}\nset -e\nnpm ci\nEOF`);

    expect(run.command).toEqual(
      heredoc(["set -e", "npm ci"], { interpreter: interpreter ?? undefined })._unsafeUnwrap(),
    );
  });

  it("keeps the body as written, including blank lines, comments, and keywords", () => {
    const body = ["# not a comment", "", "  indented", "FROM x", "trailing \\", "echo $HOME", ""];
    const run = runOf(`RUN <<'EOF'\n${body.join("\n")}\nEOF`);

    expect(run.command).toMatchObject({ lines: body });
  });

  it("derives a new delimiter from the body", () => {
    const delimiter = heredoc(["x"])._unsafeUnwrap().delimiter;

    expect(render(parsed("FROM a\nRUN <<'EOF'\nx\nEOF"))).toBe(
      `FROM a\nRUN <<'${delimiter}'\nx\n${delimiter}`,
    );
  });

  it("reads the instructions after the terminator", () => {
    expect(after("RUN <<'EOF'\nx\nEOF\nCMD y\nRUN <<'EOF'\nz\nEOF")).toMatchObject([
      { type: "RUN" },
      { type: "CMD" },
      { type: "RUN" },
    ]);
  });

  it("puts mounts and a continued start line together", () => {
    const run = runOf(
      "RUN --mount=type=cache,target=/c \\\n    python3 <<'EOF'\nprint(1)\n\n# x\nEOF",
    );

    expect(run.mounts).toMatchObject([{ type: "cache", target: "/c" }]);
    expect(run.command).toMatchObject({ interpreter: "python3", lines: ["print(1)", "", "# x"] });
  });

  it("doesn't count blank lines in the body as a break between groups", () => {
    const cf = parsed("FROM a\nRUN <<'EOF'\nx\n\ny\nEOF");

    expect("instructions" in cf && cf.instructions.every((e) => e.type !== "GROUP")).toBe(true);
  });

  it("reads a here-string as an ordinary shell command", () => {
    expect(runOf("RUN cat <<< hi").command).toBe("cat <<< hi");
  });

  it.each<[string, string, string]>([
    ["an unquoted delimiter", "RUN <<EOF\nx\nEOF", "unquoted"],
    ["a tab-stripping heredoc", "RUN <<-EOF\n\tx\n\tEOF", "<<-"],
    ["a quoted tab-stripping heredoc", "RUN <<-'EOF'\n\tx\n\tEOF", "<<-"],
    ["two heredocs", "RUN <<'A' <<'B'\nx\nA\ny\nB", "more than one"],
    [
      "a pipe after the delimiter",
      "RUN cat <<'EOF' | sort\nb\na\nEOF",
      "after the heredoc delimiter",
    ],
    [
      "a redirect after the delimiter",
      "RUN cat <<'EOF' > /f\nb\nEOF",
      "after the heredoc delimiter",
    ],
    ["a heredoc with no terminator", "RUN <<'EOF'\nx", "unterminated"],
    ["a terminator with trailing spaces", "RUN <<'EOF'\nx\nEOF  ", "unterminated"],
    ["an empty body", "RUN <<'EOF'\nEOF", "empty"],
    ["a COPY heredoc", "COPY <<EOF /d\nx\nEOF", "COPY"],
    ["an ADD heredoc", "ADD <<'EOF' /d\nx\nEOF", "ADD"],
  ])("rejects %s", (_name, text, message) => {
    const [error, ...rest] = errorsOf(`FROM a\n${text}`);

    expect(rest).toEqual([]);
    expect(error).toMatchObject({ line: 2, field: "heredoc" });
    expect(error?.message).toContain(message);
  });

  it("still reads the Dockerfile after a rejected heredoc", () => {
    expect(errorsOf("FROM a\nRUN <<EOF\nx\nEOF\nCMD ['a'\nRUN --link x")).toMatchObject([
      { line: 2, field: "heredoc" },
      { line: 6, field: "flag" },
    ]);
  });
});
