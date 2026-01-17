// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  validatePort,
  validatePortRange,
  validateImageName,
  validateDockerPath,
  validateNonEmptyString,
} from "../../src/schemas/primitives.js";

describe("validatePort property tests", () => {
  it("accepts all valid port numbers (0-65535)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 65535 }), (port) => {
        const result = validatePort(port);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe(port);
        }
      })
    );
  });

  it("rejects all integers below 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000000, max: -1 }), (port) => {
        const result = validatePort(port);
        expect(result.isErr()).toBe(true);
      })
    );
  });

  it("rejects all integers above 65535", () => {
    fc.assert(
      fc.property(fc.integer({ min: 65536, max: 1000000 }), (port) => {
        const result = validatePort(port);
        expect(result.isErr()).toBe(true);
      })
    );
  });

  it("rejects all non-integer numbers", () => {
    fc.assert(
      fc.property(
        fc.double({ noInteger: true, min: 0, max: 65535 }),
        (port) => {
          const result = validatePort(port);
          expect(result.isErr()).toBe(true);
        }
      )
    );
  });

  it("rejects all non-number values", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.boolean(), fc.object(), fc.constant(null)),
        (value) => {
          const result = validatePort(value);
          expect(result.isErr()).toBe(true);
        }
      )
    );
  });
});

describe("validatePortRange property tests", () => {
  it("accepts all valid ranges where start <= end", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 65535 }),
        fc.integer({ min: 0, max: 65535 }),
        (a, b) => {
          const start = Math.min(a, b);
          const end = Math.max(a, b);
          const result = validatePortRange({ start, end });
          expect(result.isOk()).toBe(true);
          if (result.isOk()) {
            expect(result.value.start).toBe(start);
            expect(result.value.end).toBe(end);
          }
        }
      )
    );
  });

  it("rejects all ranges where start > end (with valid ports)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 65535 }),
        fc.integer({ min: 0, max: 65534 }),
        (start, end) => {
          // Ensure start > end
          const actualStart = Math.max(start, end + 1);
          const actualEnd = Math.min(start - 1, end);
          if (actualStart <= 65535 && actualEnd >= 0 && actualStart > actualEnd) {
            const result = validatePortRange({ start: actualStart, end: actualEnd });
            expect(result.isErr()).toBe(true);
          }
        }
      )
    );
  });

  it("collects errors from both invalid start and end", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        fc.integer({ min: 65536, max: 100000 }),
        (invalidStart, invalidEnd) => {
          const result = validatePortRange({ start: invalidStart, end: invalidEnd });
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            // Should have errors for both ports
            expect(result.error.length).toBeGreaterThanOrEqual(2);
          }
        }
      )
    );
  });
});
