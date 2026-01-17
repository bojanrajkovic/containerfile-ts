// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import { from } from "../src/instructions.js";

describe("from()", () => {
  it("returns Ok for valid simple image", () => {
    const result = from("nginx");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("FROM");
      expect(result.value.image).toBe("nginx");
      expect(result.value.as).toBeNull();
      expect(result.value.platform).toBeNull();
    }
  });

  it("returns Ok for image with tag", () => {
    const result = from("node:18");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.image).toBe("node:18");
    }
  });

  it("returns Ok for image with registry path", () => {
    const result = from("ghcr.io/user/app:latest");
    expect(result.isOk()).toBe(true);
  });

  it("accepts as option", () => {
    const result = from("node:18", { as: "builder" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.as).toBe("builder");
    }
  });

  it("accepts platform option", () => {
    const result = from("node:18", { platform: "linux/amd64" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.platform).toBe("linux/amd64");
    }
  });

  it("returns Err for empty image name", () => {
    const result = from("");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("image");
    }
  });

  it("returns Err for invalid image format", () => {
    const result = from("INVALID IMAGE");
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for empty as option", () => {
    const result = from("nginx", { as: "" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("as");
    }
  });
});
