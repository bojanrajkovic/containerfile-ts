// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { from, workdir, env, expose, user, run, containerfile } from "../src/instructions.js";
import { render } from "../src/render.js";

// Generator for valid Docker image names
const validImageName = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-z0-9]+$/.test(s));

// Single-line: no line breaks and no trailing backslash, which the validators reject.
const singleLine = (s: string) => !/[\r\n]/.test(s) && !s.endsWith("\\");

// Generator for valid paths
const validPath = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && singleLine(s));

// Generator for valid port numbers
const validPort = fc.integer({ min: 0, max: 65535 });

// Generator for non-empty strings
const nonEmptyString = fc.string({ minLength: 1, maxLength: 50 }).filter(singleLine);

describe("Factory function roundtrip properties", () => {
  it("from() with valid image produces renderable FROM instruction", () => {
    fc.assert(
      fc.property(validImageName, (image) => {
        const result = from(image);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const cfResult = containerfile([result]);
          expect(cfResult.isOk()).toBe(true);
          if (cfResult.isOk()) {
            const rendered = render(cfResult.value);
            expect(rendered).toContain("FROM");
            expect(rendered).toContain(image);
          }
        }
      }),
    );
  });

  it("workdir() with valid path produces renderable WORKDIR instruction", () => {
    fc.assert(
      fc.property(validPath, (path) => {
        const result = workdir(path);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.type).toBe("WORKDIR");
          expect(result.value.path).toBe(path);
        }
      }),
    );
  });

  it("env() with valid key produces renderable ENV instruction", () => {
    fc.assert(
      fc.property(nonEmptyString, fc.string().filter(singleLine), (key, value) => {
        const result = env(key, value);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.type).toBe("ENV");
          expect(result.value.key).toBe(key);
          expect(result.value.value).toBe(value);
        }
      }),
    );
  });

  it("expose() with valid port produces renderable EXPOSE instruction", () => {
    fc.assert(
      fc.property(validPort, (port) => {
        const result = expose(port);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.type).toBe("EXPOSE");
          expect(result.value.port).toBe(port);
        }
      }),
    );
  });

  it("expose() with valid range produces renderable EXPOSE instruction", () => {
    fc.assert(
      fc.property(validPort, validPort, (a, b) => {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        const result = expose({ start, end });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.port).toBe(start);
          expect(result.value.endPort).toBe(end);
        }
      }),
    );
  });
});

describe("user() properties", () => {
  const userPart = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !/[\s:]/.test(s) && singleLine(s));

  it("renders user and group so they split back apart on ':'", () => {
    fc.assert(
      fc.property(userPart, fc.option(userPart, { nil: undefined }), (u, g) => {
        const instruction = user(u, g)._unsafeUnwrap();
        const line = render({ instructions: [instruction] });
        expect(line.slice("USER ".length).split(":")).toEqual(g === undefined ? [u] : [u, g]);
      }),
    );
  });

  it("rejects any user containing whitespace or ':'", () => {
    fc.assert(
      fc.property(userPart, fc.constantFrom(":", " ", "\t"), userPart, (a, sep, b) => {
        expect(user(a + sep + b).isErr()).toBe(true);
      }),
    );
  });
});

describe("Error collection properties", () => {
  it("containerfile collects all errors from multiple invalid instructions", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 5 }), (count) => {
        // Create 'count' invalid from instructions (empty image)
        const invalidInstructions = Array.from({ length: count }, () => from(""));
        const result = containerfile(invalidInstructions);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          // Should have at least one error per invalid instruction
          expect(result.error.length).toBeGreaterThanOrEqual(count);
        }
      }),
    );
  });
});

describe("line safety properties", () => {
  // Characters that can break or join Dockerfile lines, mixed into ordinary text.
  const lineHostile = fc.string({
    unit: fc.constantFrom("a", " ", "#", "\\", "\n", "\r", "<"),
    maxLength: 12,
  });

  it("an accepted env() always renders as one line that doesn't continue", () => {
    fc.assert(
      fc.property(lineHostile, lineHostile, (key, value) => {
        env(key, value).map((instruction) => {
          const rendered = render({ instructions: [instruction] });
          expect(rendered.split("\n")).toHaveLength(1);
          expect(rendered.endsWith("\\")).toBe(false);
        });
      }),
    );
  });

  it("an accepted shell-form run() ends its continuation on a command line", () => {
    fc.assert(
      fc.property(lineHostile, (command) => {
        run(command).map((instruction) => {
          const lines = render({ instructions: [instruction] }).split("\n");
          for (const line of lines.slice(0, -1)) {
            expect(line.endsWith("\\")).toBe(true);
          }
          const last = lines[lines.length - 1];
          expect(last.endsWith("\\")).toBe(false);
          expect(last.trimStart().startsWith("#")).toBe(false);
          expect(last.includes("\r")).toBe(false);
        });
      }),
    );
  });
});
