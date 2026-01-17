// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  validatePort,
  validateImageName,
  validateDockerPath,
  validatePortRange,
  type PortRange,
  validateNonEmptyString,
  validateStringArray,
} from "../../src/schemas/primitives.js";

describe("validatePort", () => {
  it("accepts valid port numbers", () => {
    expect(validatePort(0).isOk()).toBe(true);
    expect(validatePort(80).isOk()).toBe(true);
    expect(validatePort(443).isOk()).toBe(true);
    expect(validatePort(8080).isOk()).toBe(true);
    expect(validatePort(65535).isOk()).toBe(true);
  });

  it("rejects non-integers", () => {
    const result = validatePort(80.5);
    expect(result.isErr()).toBe(true);
  });

  it("rejects negative numbers", () => {
    const result = validatePort(-1);
    expect(result.isErr()).toBe(true);
  });

  it("rejects numbers above 65535", () => {
    const result = validatePort(65536);
    expect(result.isErr()).toBe(true);
  });

  it("rejects non-numbers", () => {
    expect(validatePort("80").isErr()).toBe(true);
    expect(validatePort(null).isErr()).toBe(true);
    expect(validatePort(undefined).isErr()).toBe(true);
  });

  it("includes field name in error", () => {
    const result = validatePort("bad", "customField");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("customField");
    }
  });
});

describe("validateImageName", () => {
  it("accepts simple image names", () => {
    expect(validateImageName("nginx").isOk()).toBe(true);
    expect(validateImageName("node").isOk()).toBe(true);
    expect(validateImageName("alpine").isOk()).toBe(true);
  });

  it("accepts images with tags", () => {
    expect(validateImageName("node:18").isOk()).toBe(true);
    expect(validateImageName("nginx:latest").isOk()).toBe(true);
    expect(validateImageName("python:3.11-slim").isOk()).toBe(true);
  });

  it("accepts images with registry paths", () => {
    expect(validateImageName("ghcr.io/user/app").isOk()).toBe(true);
    expect(validateImageName("docker.io/library/nginx").isOk()).toBe(true);
    expect(validateImageName("registry.example.com:5000/myapp").isOk()).toBe(true);
  });

  it("accepts images with digests", () => {
    expect(validateImageName("nginx@sha256:abc123def456").isOk()).toBe(true);
  });

  it("rejects empty strings", () => {
    const result = validateImageName("");
    expect(result.isErr()).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(validateImageName("UPPERCASE").isErr()).toBe(true);
    expect(validateImageName("has spaces").isErr()).toBe(true);
  });

  it("includes field name in error", () => {
    const result = validateImageName("", "baseImage");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("baseImage");
    }
  });
});

describe("validateDockerPath", () => {
  it("accepts valid paths", () => {
    expect(validateDockerPath("/app").isOk()).toBe(true);
    expect(validateDockerPath("./src").isOk()).toBe(true);
    expect(validateDockerPath("package.json").isOk()).toBe(true);
    expect(validateDockerPath("/usr/local/bin").isOk()).toBe(true);
  });

  it("rejects empty strings", () => {
    const result = validateDockerPath("");
    expect(result.isErr()).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(validateDockerPath(123).isErr()).toBe(true);
    expect(validateDockerPath(null).isErr()).toBe(true);
    expect(validateDockerPath(undefined).isErr()).toBe(true);
  });

  it("includes field name in error", () => {
    const result = validateDockerPath("", "destination");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("destination");
    }
  });
});

describe("validatePortRange", () => {
  it("accepts valid port ranges", () => {
    expect(validatePortRange({ start: 80, end: 90 }).isOk()).toBe(true);
    expect(validatePortRange({ start: 8080, end: 8080 }).isOk()).toBe(true);
    expect(validatePortRange({ start: 0, end: 65535 }).isOk()).toBe(true);
  });

  it("rejects ranges where start > end", () => {
    const result = validatePortRange({ start: 100, end: 50 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].message).toContain("start");
      expect(result.error[0].message).toContain("end");
    }
  });

  it("rejects invalid start port", () => {
    const result = validatePortRange({ start: -1, end: 80 });
    expect(result.isErr()).toBe(true);
  });

  it("rejects invalid end port", () => {
    const result = validatePortRange({ start: 80, end: 70000 });
    expect(result.isErr()).toBe(true);
  });

  it("collects all errors when both ports invalid", () => {
    const result = validatePortRange({ start: -1, end: 70000 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      // Should have errors for both start and end
      expect(result.error.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("validateNonEmptyString", () => {
  it("accepts non-empty strings", () => {
    expect(validateNonEmptyString("hello").isOk()).toBe(true);
    expect(validateNonEmptyString(" ").isOk()).toBe(true);
    expect(validateNonEmptyString("a").isOk()).toBe(true);
  });

  it("rejects empty strings", () => {
    const result = validateNonEmptyString("");
    expect(result.isErr()).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(validateNonEmptyString(123).isErr()).toBe(true);
    expect(validateNonEmptyString(null).isErr()).toBe(true);
  });
});

describe("validateStringArray", () => {
  it("accepts arrays of non-empty strings", () => {
    expect(validateStringArray(["a", "b", "c"]).isOk()).toBe(true);
    expect(validateStringArray(["single"]).isOk()).toBe(true);
  });

  it("rejects empty arrays", () => {
    const result = validateStringArray([]);
    expect(result.isErr()).toBe(true);
  });

  it("rejects arrays with empty strings", () => {
    const result = validateStringArray(["valid", "", "also-valid"]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toContain("[1]");
    }
  });

  it("collects all errors for multiple invalid elements", () => {
    const result = validateStringArray(["", "", ""]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.length).toBe(3);
    }
  });

  it("uses custom field name", () => {
    const result = validateStringArray([""], "command");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("command[0]");
    }
  });
});
