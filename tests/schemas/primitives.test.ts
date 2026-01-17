// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  validatePort,
  validateImageName,
  validateDockerPath,
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
    expect(
      validateImageName("nginx@sha256:abc123def456").isOk()
    ).toBe(true);
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
