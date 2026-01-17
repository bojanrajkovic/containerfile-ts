// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { from, workdir, env, expose, containerfile } from "../src/instructions.js";
import { render } from "../src/render.js";

// Generator for valid Docker image names
const validImageName = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-z0-9]+$/.test(s));

// Generator for valid paths
const validPath = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

// Generator for valid port numbers
const validPort = fc.integer({ min: 0, max: 65535 });

// Generator for non-empty strings
const nonEmptyString = fc.string({ minLength: 1, maxLength: 50 });

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
      fc.property(nonEmptyString, fc.string(), (key, value) => {
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
