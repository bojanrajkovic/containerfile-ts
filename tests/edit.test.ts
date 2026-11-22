// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  cmd,
  comment,
  containerfile,
  copy,
  edit,
  env,
  expose,
  from,
  group,
  parse,
  render,
  run,
  stage,
  workdir,
  type Containerfile,
  type ContainerfileEditor,
  type Instruction,
} from "../src/index.js";
import { describeWithBuildKit, parseWithBuildKit } from "./support/buildkit.js";

const isType = (type: Instruction["type"]) => (instruction: Instruction) =>
  instruction.type === type;

/** FROM, WORKDIR, RUN, CMD: one block, no groups. */
function single(): Containerfile {
  return containerfile([
    from("node:20"),
    workdir("/app"),
    run("npm ci"),
    cmd(["node", "a.js"]),
  ])._unsafeUnwrap();
}

/** The same four instructions as two groups. */
function grouped(): Containerfile {
  return containerfile([
    group([from("node:20"), workdir("/app")]),
    group(comment("Build"), [run("npm ci"), cmd(["node", "a.js"])]),
  ])._unsafeUnwrap();
}

function twoStages(): Containerfile {
  return containerfile([
    stage("build", [from("node:20", { as: "build" }), run("npm ci"), run("npm run build")]),
    stage("runtime", [
      from("nginx"),
      copy("dist", "/usr/share/nginx/html", { from: "build" }),
      cmd(["nginx"]),
    ]),
  ])._unsafeUnwrap();
}

function built(editor: ContainerfileEditor): string {
  return render(editor.build()._unsafeUnwrap());
}

describe("edit() on a single-stage containerfile", () => {
  it("append adds instructions at the end, in order", () => {
    expect(built(edit(single()).append(expose(3000), env("A", "b")))).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        "RUN npm ci",
        'CMD ["node", "a.js"]',
        "EXPOSE 3000",
        'ENV A="b"',
      ].join("\n"),
    );
  });

  it("prepend adds instructions at the start, in order", () => {
    expect(built(edit(single()).prepend(env("A", "b"), expose(3000)))).toBe(
      [
        'ENV A="b"',
        "EXPOSE 3000",
        "FROM node:20",
        "WORKDIR /app",
        "RUN npm ci",
        'CMD ["node", "a.js"]',
      ].join("\n"),
    );
  });

  it("insertBefore puts instructions above the match", () => {
    expect(built(edit(single()).insertBefore(isType("RUN"), env("A", "b"), expose(1)))).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        'ENV A="b"',
        "EXPOSE 1",
        "RUN npm ci",
        'CMD ["node", "a.js"]',
      ].join("\n"),
    );
  });

  it("insertAfter puts instructions below the match", () => {
    expect(
      built(edit(single()).insertAfter(isType("WORKDIR"), env("NODE_ENV", "production"))),
    ).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        'ENV NODE_ENV="production"',
        "RUN npm ci",
        'CMD ["node", "a.js"]',
      ].join("\n"),
    );
  });

  it("replace swaps the match for the given instructions", () => {
    expect(built(edit(single()).replace(isType("RUN"), run("npm ci --omit=dev"), expose(1)))).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        "RUN npm ci --omit=dev",
        "EXPOSE 1",
        'CMD ["node", "a.js"]',
      ].join("\n"),
    );
  });

  it("remove deletes the match", () => {
    expect(built(edit(single()).remove(isType("WORKDIR")))).toBe(
      ["FROM node:20", "RUN npm ci", 'CMD ["node", "a.js"]'].join("\n"),
    );
  });

  it("applies to every instruction a predicate matches", () => {
    const cf = containerfile([from("alpine"), run("a"), run("b")])._unsafeUnwrap();
    expect(built(edit(cf).insertAfter(isType("RUN"), env("X", "1")))).toBe(
      ["FROM alpine", "RUN a", 'ENV X="1"', "RUN b", 'ENV X="1"'].join("\n"),
    );
    expect(built(edit(cf).remove(isType("RUN")))).toBe("FROM alpine");
  });

  it("applies the calls in order, so later calls see earlier ones", () => {
    expect(
      built(
        edit(single())
          .append(expose(3000))
          .insertAfter(isType("EXPOSE"), env("A", "b"))
          .remove(isType("WORKDIR")),
      ),
    ).toBe(
      ["FROM node:20", "RUN npm ci", 'CMD ["node", "a.js"]', "EXPOSE 3000", 'ENV A="b"'].join("\n"),
    );
  });
});

describe("edit() with groups", () => {
  it("insertAfter and replace stay inside the group of the match", () => {
    expect(
      built(
        edit(grouped())
          .insertAfter(isType("WORKDIR"), env("A", "b"))
          .replace(isType("RUN"), run("npm ci --omit=dev")),
      ),
    ).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        'ENV A="b"',
        "",
        "# Build",
        "RUN npm ci --omit=dev",
        'CMD ["node", "a.js"]',
      ].join("\n"),
    );
  });

  it("remove drops an instruction from its group", () => {
    expect(built(edit(grouped()).remove(isType("CMD")))).toBe(
      ["FROM node:20", "WORKDIR /app", "", "# Build", "RUN npm ci"].join("\n"),
    );
  });

  it("append adds an ungrouped instruction as its own block after the groups", () => {
    expect(built(edit(grouped()).append(expose(3000)))).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        "",
        "# Build",
        "RUN npm ci",
        'CMD ["node", "a.js"]',
        "",
        "EXPOSE 3000",
      ].join("\n"),
    );
  });

  it("append takes a group", () => {
    expect(built(edit(single()).append(group([expose(3000), expose(8080)])))).toBe(
      [
        "FROM node:20",
        "WORKDIR /app",
        "RUN npm ci",
        'CMD ["node", "a.js"]',
        "",
        "EXPOSE 3000",
        "EXPOSE 8080",
      ].join("\n"),
    );
  });

  it("prepend takes a group", () => {
    expect(built(edit(single()).prepend(group([env("A", "b"), env("C", "d")])))).toBe(
      [
        'ENV A="b"',
        'ENV C="d"',
        "",
        "FROM node:20",
        "WORKDIR /app",
        "RUN npm ci",
        'CMD ["node", "a.js"]',
      ].join("\n"),
    );
  });

  it("remove can't empty a group", () => {
    const errors = edit(grouped()).remove(isType("RUN")).remove(isType("CMD")).build();
    expect(errors._unsafeUnwrapErr().map((e) => e.field)).toEqual(["edits[1].remove"]);
    expect(errors._unsafeUnwrapErr()[0]?.message).toBe("would leave a group empty");
  });
});

describe("edit() on a multi-stage containerfile", () => {
  it("append goes to the last stage, prepend to the first", () => {
    expect(built(edit(twoStages()).append(expose(80)).prepend(env("A", "b")))).toBe(
      [
        'ENV A="b"',
        "FROM node:20 AS build",
        "RUN npm ci",
        "RUN npm run build",
        "",
        "FROM nginx",
        "COPY --from=build dist /usr/share/nginx/html",
        'CMD ["nginx"]',
        "EXPOSE 80",
      ].join("\n"),
    );
  });

  it("matches across every stage from the top level", () => {
    expect(built(edit(twoStages()).insertAfter(isType("FROM"), env("A", "b")))).toBe(
      [
        "FROM node:20 AS build",
        'ENV A="b"',
        "RUN npm ci",
        "RUN npm run build",
        "",
        "FROM nginx",
        'ENV A="b"',
        "COPY --from=build dist /usr/share/nginx/html",
        'CMD ["nginx"]',
      ].join("\n"),
    );
  });

  it("stage() scopes the edits to one stage", () => {
    expect(
      built(
        edit(twoStages()).stage("build", (s) =>
          s.replace(isType("RUN"), run("pnpm i")).append(expose(1)),
        ),
      ),
    ).toBe(
      [
        "FROM node:20 AS build",
        "RUN pnpm i",
        "RUN pnpm i",
        "EXPOSE 1",
        "",
        "FROM nginx",
        "COPY --from=build dist /usr/share/nginx/html",
        'CMD ["nginx"]',
      ].join("\n"),
    );
  });

  it("stage() append and prepend act on that stage only", () => {
    expect(
      built(edit(twoStages()).stage("runtime", (s) => s.prepend(env("A", "b")).append(expose(2)))),
    ).toBe(
      [
        "FROM node:20 AS build",
        "RUN npm ci",
        "RUN npm run build",
        "",
        'ENV A="b"',
        "FROM nginx",
        "COPY --from=build dist /usr/share/nginx/html",
        'CMD ["nginx"]',
        "EXPOSE 2",
      ].join("\n"),
    );
  });

  it("stage() edits the first stage with the name when names repeat", () => {
    const cf = containerfile([
      stage("app", [from("alpine"), run("one")]),
      stage("app", [from("busybox"), run("two")]),
    ])._unsafeUnwrap();

    expect(built(edit(cf).stage("app", (s) => s.append(expose(1))))).toBe(
      ["FROM alpine", "RUN one", "EXPOSE 1", "", "FROM busybox", "RUN two"].join("\n"),
    );
  });

  it("a predicate inside stage() doesn't match other stages", () => {
    const errors = edit(twoStages())
      .stage("build", (s) => s.remove(isType("CMD")))
      .build()
      ._unsafeUnwrapErr();
    expect(errors.map((e) => e.field)).toEqual(["edits[0].edits[0].remove"]);
  });
});

describe("edit() immutability", () => {
  it("never changes the containerfile it was given", () => {
    const cf = grouped();
    const before = JSON.stringify(cf);
    edit(cf).append(expose(1)).remove(isType("WORKDIR")).insertAfter(isType("RUN"), env("A", "b"));
    edit(cf).append(expose(1)).build();
    expect(JSON.stringify(cf)).toBe(before);
  });

  it("gives independent results when one builder is reused", () => {
    const base = edit(single());
    const a = base.append(expose(1));
    const b = base.append(expose(2));

    expect(built(a)).toContain("EXPOSE 1");
    expect(built(a)).not.toContain("EXPOSE 2");
    expect(built(b)).toContain("EXPOSE 2");
    expect(built(b)).not.toContain("EXPOSE 1");
    expect(built(base)).toBe(render(single()));
  });

  it("build() twice gives equal results", () => {
    const editor = edit(single()).append(expose(1));
    expect(editor.build()._unsafeUnwrap()).toEqual(editor.build()._unsafeUnwrap());
  });
});

describe("edit() errors", () => {
  it("reports an invalid item with the call, method, argument, and field", () => {
    const errors = edit(single()).append(expose(3000), expose(99999)).build()._unsafeUnwrapErr();
    expect(errors.map((e) => e.field)).toEqual(["edits[0].append[1].port"]);
  });

  it("collects errors from every call, in call order", () => {
    const errors = edit(single())
      .prepend(expose(99999))
      .insertAfter(isType("USER"), expose(1))
      .replace(isType("RUN"), run(""), expose(70000))
      .build()
      ._unsafeUnwrapErr();
    expect(errors.map((e) => e.field)).toEqual([
      "edits[0].prepend[0].port",
      "edits[1].insertAfter",
      "edits[2].replace[0].command",
      "edits[2].replace[1].port",
    ]);
  });

  it("a predicate that matches nothing is an error", () => {
    for (const method of ["insertBefore", "insertAfter", "replace"] as const) {
      const errors = edit(single())[method](isType("USER"), expose(1)).build()._unsafeUnwrapErr();
      expect(errors).toEqual([
        {
          field: `edits[0].${method}`,
          message: "no instruction matches",
          value: expect.any(Function),
        },
      ]);
    }
    const errors = edit(single()).remove(isType("USER")).build()._unsafeUnwrapErr();
    expect(errors.map((e) => e.field)).toEqual(["edits[0].remove"]);
  });

  it("remove can't empty the containerfile or a stage", () => {
    const file = edit(containerfile([from("alpine")])._unsafeUnwrap())
      .remove(isType("FROM"))
      .build()
      ._unsafeUnwrapErr();
    expect(file).toMatchObject([
      { field: "edits[0].remove", message: "would leave the containerfile empty" },
    ]);

    const inStage = edit(twoStages())
      .stage("build", (s) => s.remove(() => true))
      .build()
      ._unsafeUnwrapErr();
    expect(inStage).toMatchObject([
      { field: "edits[0].edits[0].remove", message: "would leave stage build empty" },
    ]);
  });

  it("stage() on a single-stage containerfile is an error", () => {
    const errors = edit(single())
      .stage("build", (s) => s)
      .build()
      ._unsafeUnwrapErr();
    expect(errors).toMatchObject([
      { field: "edits[0].stage", message: "containerfile has no stages", value: "build" },
    ]);
  });

  it("stage() with an unknown name is an error", () => {
    const errors = edit(twoStages())
      .stage("test", (s) => s)
      .build()
      ._unsafeUnwrapErr();
    expect(errors).toMatchObject([
      { field: "edits[0].stage", message: "no stage named test", value: "test" },
    ]);
  });

  it("reports errors inside stage() with the path through it", () => {
    const errors = edit(twoStages())
      .stage("build", (s) => s.append(expose(99999)).insertAfter(isType("USER"), expose(1)))
      .build()
      ._unsafeUnwrapErr();
    expect(errors.map((e) => e.field)).toEqual([
      "edits[0].edits[0].append[0].port",
      "edits[0].edits[1].insertAfter",
    ]);
  });

  it("stage() must get back the editor it passed in", () => {
    const errors = edit(twoStages())
      .stage("build", () => ({}) as never)
      .build()
      ._unsafeUnwrapErr();
    expect(errors).toMatchObject([
      { field: "edits[0].stage", message: "the callback must return the editor it was given" },
    ]);
  });

  it("keeps working after a failed call: later calls still run and report", () => {
    const errors = edit(single())
      .append(expose(99999))
      .remove(isType("USER"))
      .build()
      ._unsafeUnwrapErr();
    expect(errors.map((e) => e.field)).toEqual(["edits[0].append[0].port", "edits[1].remove"]);
  });
});

describe("edit() on parsed Dockerfiles", () => {
  const dockerfile = [
    "FROM node:20-alpine",
    "WORKDIR /app",
    "COPY . .",
    "RUN npm ci",
    'CMD ["node", "index.js"]',
  ].join("\n");

  function edited(): string {
    return parse(dockerfile)
      .andThen((cf) =>
        edit(cf)
          .insertAfter(isType("WORKDIR"), env("NODE_ENV", "production"))
          .append(expose(3000))
          .build(),
      )
      .map(render)
      ._unsafeUnwrap();
  }

  it("round trips a Dockerfile through parse, edit, and render", () => {
    expect(edited()).toBe(
      [
        "FROM node:20-alpine",
        "WORKDIR /app",
        'ENV NODE_ENV="production"',
        "COPY . .",
        "RUN npm ci",
        'CMD ["node", "index.js"]',
        "EXPOSE 3000",
      ].join("\n"),
    );
  });

  it("produces the README example", () => {
    const text = [
      "FROM node:20-alpine AS build",
      "WORKDIR /app",
      "RUN npm install",
      "",
      "FROM nginx",
      'CMD ["nginx"]',
    ].join("\n");

    const result = parse(text)
      .andThen((cf) =>
        edit(cf)
          .insertAfter((i) => i.type === "WORKDIR", env("NODE_ENV", "production"))
          .stage("build", (s) => s.replace((i) => i.type === "RUN", run("npm ci")))
          .append(expose(80))
          .build(),
      )
      .map(render);

    expect(result._unsafeUnwrap()).toBe(
      [
        "FROM node:20-alpine AS build",
        "WORKDIR /app",
        'ENV NODE_ENV="production"',
        "RUN npm ci",
        "",
        "FROM nginx",
        'CMD ["nginx"]',
        "EXPOSE 80",
      ].join("\n"),
    );
  });

  describeWithBuildKit("with BuildKit", () => {
    it("reads the edited Dockerfile as the edited instructions", () => {
      const parsed = parseWithBuildKit(edited());
      expect(parsed.warnings).toEqual([]);
      expect(parsed.instructions.map((i) => i.error ?? null)).toEqual(
        parsed.instructions.map(() => null),
      );
      expect(parsed.instructions.map((i) => i.cmd.toUpperCase())).toEqual([
        "FROM",
        "WORKDIR",
        "ENV",
        "COPY",
        "RUN",
        "CMD",
        "EXPOSE",
      ]);
    });
  });
});
