// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import { comment, containerfile, from, group, run, stage, render } from "../src/index.js";

function renderOk(result: ReturnType<typeof containerfile>): string {
  return result.match(render, (errors) => {
    throw new Error(JSON.stringify(errors));
  });
}

describe("render() with groups", () => {
  it("puts one blank line between adjacent groups and none at the edges", () => {
    const output = renderOk(
      containerfile([group([from("node")]), group([run("a")]), group([run("b")])]),
    );
    expect(output).toBe("FROM node\n\nRUN a\n\nRUN b");
  });

  it("separates a group from ungrouped neighbours, which stay tight", () => {
    const output = renderOk(
      containerfile([from("node"), run("a"), group([run("b"), run("c")]), run("d"), run("e")]),
    );
    expect(output).toBe("FROM node\nRUN a\n\nRUN b\nRUN c\n\nRUN d\nRUN e");
  });

  it("renders a group's comment directly above its first instruction", () => {
    const output = renderOk(
      containerfile([from("node"), group(comment("Build", "twice"), [run("a"), run("b")])]),
    );
    expect(output).toBe("FROM node\n\n# Build\n# twice\nRUN a\nRUN b");
  });

  it("adds no blank line at the start or end of a stage", () => {
    const output = renderOk(
      containerfile([
        stage("one", [group([from("node", { as: "one" })]), run("a")]),
        stage("two", [from("node"), group([run("b")])]),
      ]),
    );
    expect(output).toBe("FROM node AS one\n\nRUN a\n\nFROM node\n\nRUN b");
  });
});
