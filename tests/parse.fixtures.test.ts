// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse, render } from "../src/index.js";

const fixturesDir = join(import.meta.dirname, "fixtures");

describe("parse() reads every fixture back", () => {
  const fixtures = readdirSync(fixturesDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const { name } of fixtures) {
    it(`renders ${name} as the same Dockerfile`, () => {
      const expected = readFileSync(join(fixturesDir, name, "expected.Dockerfile"), "utf-8").trim();

      expect(render(parse(expected)._unsafeUnwrap())).toBe(expected);
    });
  }
});
