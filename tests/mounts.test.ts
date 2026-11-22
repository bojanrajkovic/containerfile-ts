// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  chain,
  containerfile,
  from,
  heredoc,
  render,
  run,
  type MountOptions,
  type RunInstruction,
} from "../src/index.js";

/** The rendered RUN, without the FROM line above it. */
function runLine(...args: Parameters<typeof run>): string {
  const cf = containerfile([from("alpine"), run(...args)])._unsafeUnwrap();
  return render(cf).split("\n").slice(1).join("\n");
}

function mountError(mount: unknown) {
  return run("true", { mounts: [mount as MountOptions] });
}

describe("run() mounts", () => {
  it("defaults to no mounts", () => {
    expect(run("npm ci")._unsafeUnwrap().mounts).toEqual([]);
  });

  it("fills every absent field of a cache mount with null or false", () => {
    const instruction: RunInstruction = run("npm ci", {
      mounts: [{ type: "cache", target: "/root/.npm" }],
    })._unsafeUnwrap();

    expect(instruction.mounts).toEqual([
      {
        type: "cache",
        target: "/root/.npm",
        id: null,
        sharing: null,
        from: null,
        source: null,
        mode: null,
        uid: null,
        gid: null,
        readonly: false,
      },
    ]);
  });

  it("keeps every option of each mount type", () => {
    const instruction = run("true", {
      mounts: [
        { type: "bind", target: "/src", source: ".", from: "build", readwrite: true },
        {
          type: "cache",
          target: "/c",
          id: "npm",
          sharing: "locked",
          from: "base",
          source: "/s",
          mode: 0o755,
          uid: 1000,
          gid: 1000,
          readonly: true,
        },
        { type: "tmpfs", target: "/tmp", size: "64m" },
        {
          type: "secret",
          id: "npmrc",
          target: "/root/.npmrc",
          env: "NPM_TOKEN",
          required: true,
          mode: 0o600,
          uid: 0,
          gid: 0,
        },
        { type: "ssh", id: "default", target: "/ssh", required: true, mode: 0o600, uid: 1, gid: 2 },
      ],
    })._unsafeUnwrap();

    expect(instruction.mounts).toEqual([
      { type: "bind", target: "/src", source: ".", from: "build", readwrite: true },
      {
        type: "cache",
        target: "/c",
        id: "npm",
        sharing: "locked",
        from: "base",
        source: "/s",
        mode: 0o755,
        uid: 1000,
        gid: 1000,
        readonly: true,
      },
      { type: "tmpfs", target: "/tmp", size: "64m" },
      {
        type: "secret",
        id: "npmrc",
        target: "/root/.npmrc",
        env: "NPM_TOKEN",
        required: true,
        mode: 0o600,
        uid: 0,
        gid: 0,
      },
      { type: "ssh", id: "default", target: "/ssh", required: true, mode: 0o600, uid: 1, gid: 2 },
    ]);
  });

  describe("validation", () => {
    it.each<[string, unknown, string]>([
      ["a missing target", { type: "cache" }, "mounts[0].target"],
      ["an empty target", { type: "bind", target: "" }, "mounts[0].target"],
      ["a comma in a path", { type: "bind", target: "/a,b" }, "mounts[0].target"],
      ["a quote in a path", { type: "bind", target: '/a"b' }, "mounts[0].target"],
      ["a space in a path", { type: "bind", target: "/a b" }, "mounts[0].target"],
      ["a backslash in an id", { type: "cache", target: "/c", id: "a\\b" }, "mounts[0].id"],
      ["a single quote in an id", { type: "cache", target: "/c", id: "a'b" }, "mounts[0].id"],
      ["a line break in an id", { type: "cache", target: "/c", id: "a\nb" }, "mounts[0].id"],
      ["a comma in an id", { type: "cache", target: "/c", id: "a,b" }, "mounts[0].id"],
      ["a variable in from", { type: "bind", target: "/c", from: "$S" }, "mounts[0].from"],
      [
        "an unknown sharing mode",
        { type: "cache", target: "/c", sharing: "x" },
        "mounts[0].sharing",
      ],
      ["a negative uid", { type: "cache", target: "/c", uid: -1 }, "mounts[0].uid"],
      ["a fractional gid", { type: "cache", target: "/c", gid: 1.5 }, "mounts[0].gid"],
      ["a uid over 32 bits", { type: "cache", target: "/c", uid: 2 ** 32 }, "mounts[0].uid"],
      ["a mode over 07777", { type: "cache", target: "/c", mode: 0o10000 }, "mounts[0].mode"],
      ["a bad tmpfs size", { type: "tmpfs", target: "/t", size: "lots" }, "mounts[0].size"],
      ["a bad secret env name", { type: "secret", id: "x", env: "1A" }, "mounts[0].env"],
      ["a secret with no id or target", { type: "secret" }, "mounts[0]"],
      ["an unknown type", { type: "volume", target: "/v" }, "mounts[0].type"],
      ["a non-object mount", "cache", "mounts[0]"],
    ])("rejects %s", (_name, mount, field) => {
      const errors = mountError(mount)._unsafeUnwrapErr();
      expect(errors.map((e) => e.field)).toContain(field);
    });

    it("accepts a secret with only a target, or only an id", () => {
      expect(mountError({ type: "secret", id: "x" }).isOk()).toBe(true);
      expect(mountError({ type: "secret", target: "/run/x" }).isOk()).toBe(true);
    });

    it("collects the errors of every mount", () => {
      const errors = run("true", {
        mounts: [
          { type: "cache", target: "" },
          { type: "tmpfs", target: "/t" },
          { type: "bind" } as never,
        ],
      })._unsafeUnwrapErr();
      expect(errors.map((e) => e.field)).toEqual(["mounts[0].target", "mounts[2].target"]);
    });

    it("rejects mounts that aren't an array", () => {
      const errors = run("true", { mounts: "cache" as never })._unsafeUnwrapErr();
      expect(errors.map((e) => e.field)).toEqual(["mounts"]);
    });

    it("reports command and mount errors together", () => {
      const errors = run("", { mounts: [{ type: "cache", target: "" }] })._unsafeUnwrapErr();
      expect(errors.map((e) => e.field).sort()).toEqual(["command", "mounts[0].target"]);
    });
  });
});

describe("render() of RUN with mounts", () => {
  it("puts each mount as its own flag before the command", () => {
    expect(
      runLine("npm ci", {
        mounts: [
          { type: "cache", target: "/root/.npm", id: "npm", sharing: "locked" },
          { type: "secret", id: "npmrc", target: "/root/.npmrc", required: true },
        ],
      }),
    ).toBe(
      "RUN --mount=type=cache,target=/root/.npm,id=npm,sharing=locked " +
        "--mount=type=secret,id=npmrc,target=/root/.npmrc,required npm ci",
    );
  });

  it("renders a read-write bind mount and a read-only cache mount", () => {
    expect(
      runLine("true", {
        mounts: [
          { type: "bind", source: ".", target: "/src", readwrite: true },
          { type: "cache", target: "/c", readonly: true },
        ],
      }),
    ).toBe("RUN --mount=type=bind,source=.,target=/src,rw --mount=type=cache,target=/c,ro true");
  });

  it("renders mode as four octal digits", () => {
    expect(runLine("true", { mounts: [{ type: "ssh", mode: 0o600, uid: 1, gid: 2 }] })).toBe(
      "RUN --mount=type=ssh,mode=0600,uid=1,gid=2 true",
    );
  });

  it("renders a tmpfs size and a secret env", () => {
    expect(
      runLine("true", {
        mounts: [
          { type: "tmpfs", target: "/tmp", size: "64m" },
          { type: "secret", id: "t", env: "TOKEN" },
        ],
      }),
    ).toBe("RUN --mount=type=tmpfs,target=/tmp,size=64m --mount=type=secret,id=t,env=TOKEN true");
  });

  it("goes before exec form", () => {
    expect(runLine(["npm", "ci"], { mounts: [{ type: "tmpfs", target: "/t" }] })).toBe(
      'RUN --mount=type=tmpfs,target=/t ["npm", "ci"]',
    );
  });

  it("goes before a chain", () => {
    expect(runLine(chain(["a", "b"]), { mounts: [{ type: "tmpfs", target: "/t" }] })).toBe(
      "RUN --mount=type=tmpfs,target=/t a \\\n    && b",
    );
  });

  it("goes before a heredoc's interpreter", () => {
    const script = heredoc(["print(1)"], { interpreter: "python3" });
    const { delimiter } = script._unsafeUnwrap();

    expect(runLine(script, { mounts: [{ type: "tmpfs", target: "/t" }] })).toBe(
      `RUN --mount=type=tmpfs,target=/t python3 <<'${delimiter}'\nprint(1)\n${delimiter}`,
    );
  });

  it("leaves a RUN without mounts unchanged", () => {
    expect(runLine("npm ci")).toBe("RUN npm ci");
  });
});
