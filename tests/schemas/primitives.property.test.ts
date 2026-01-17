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
      }),
    );
  });

  it("rejects all integers below 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000000, max: -1 }), (port) => {
        const result = validatePort(port);
        expect(result.isErr()).toBe(true);
      }),
    );
  });

  it("rejects all integers above 65535", () => {
    fc.assert(
      fc.property(fc.integer({ min: 65536, max: 1000000 }), (port) => {
        const result = validatePort(port);
        expect(result.isErr()).toBe(true);
      }),
    );
  });

  it("rejects all non-integer numbers", () => {
    fc.assert(
      fc.property(fc.double({ noInteger: true, min: 0, max: 65535 }), (port) => {
        const result = validatePort(port);
        expect(result.isErr()).toBe(true);
      }),
    );
  });

  it("rejects all non-number values", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.boolean(), fc.object(), fc.constant(null)), (value) => {
        const result = validatePort(value);
        expect(result.isErr()).toBe(true);
      }),
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
        },
      ),
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
        },
      ),
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
        },
      ),
    );
  });
});

describe("validateNonEmptyString property tests", () => {
  it("accepts all non-empty strings", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (str) => {
        const result = validateNonEmptyString(str);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe(str);
        }
      }),
    );
  });

  it("rejects empty string", () => {
    const result = validateNonEmptyString("");
    expect(result.isErr()).toBe(true);
  });

  it("rejects all non-string values", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.double(),
          fc.boolean(),
          fc.object(),
          fc.constant(null),
          fc.constant(undefined),
        ),
        (value) => {
          const result = validateNonEmptyString(value);
          expect(result.isErr()).toBe(true);
        },
      ),
    );
  });
});

describe("validateDockerPath property tests", () => {
  it("accepts all non-empty strings as paths", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (path) => {
        const result = validateDockerPath(path);
        expect(result.isOk()).toBe(true);
      }),
    );
  });

  it("rejects empty path", () => {
    const result = validateDockerPath("");
    expect(result.isErr()).toBe(true);
  });
});

describe("validateImageName property tests", () => {
  // Generator for valid simple image names (lowercase alphanumeric with separators)
  const simpleImageName = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => /^[a-z0-9]+$/.test(s)); // Only lowercase alphanumeric

  // Generator for valid tags
  const validTag = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => /^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/.test(s)); // Valid tag characters

  it("accepts simple image names", () => {
    fc.assert(
      fc.property(simpleImageName, (name) => {
        const result = validateImageName(name);
        expect(result.isOk()).toBe(true);
      }),
    );
  });

  it("accepts image names with tags", () => {
    fc.assert(
      fc.property(simpleImageName, validTag, (name, tag) => {
        const result = validateImageName(`${name}:${tag}`);
        expect(result.isOk()).toBe(true);
      }),
    );
  });

  it("rejects empty strings", () => {
    const result = validateImageName("");
    expect(result.isErr()).toBe(true);
  });

  it("rejects strings with uppercase in image name part", () => {
    // Image names (not tags) must be lowercase
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[A-Z]+$/.test(s)),
        (upperName) => {
          const result = validateImageName(upperName);
          expect(result.isErr()).toBe(true);
        },
      ),
    );
  });

  it("rejects strings with spaces", () => {
    fc.assert(
      fc.property(
        fc.tuple(simpleImageName, simpleImageName).map(([a, b]) => `${a} ${b}`),
        (nameWithSpace) => {
          const result = validateImageName(nameWithSpace);
          expect(result.isErr()).toBe(true);
        },
      ),
    );
  });
});
