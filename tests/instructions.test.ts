// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import { from, workdir, env, label, arg } from "../src/instructions.js";

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

describe("workdir()", () => {
  it("returns Ok for valid path", () => {
    const result = workdir("/app");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("WORKDIR");
      expect(result.value.path).toBe("/app");
    }
  });

  it("returns Err for empty path", () => {
    const result = workdir("");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("path");
    }
  });
});

describe("env()", () => {
  it("returns Ok for valid key-value", () => {
    const result = env("NODE_ENV", "production");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("ENV");
      expect(result.value.key).toBe("NODE_ENV");
      expect(result.value.value).toBe("production");
    }
  });

  it("returns Err for empty key", () => {
    const result = env("", "value");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("key");
    }
  });

  it("allows empty value", () => {
    const result = env("KEY", "");
    expect(result.isOk()).toBe(true);
  });
});

describe("label()", () => {
  it("returns Ok for valid key-value", () => {
    const result = label("maintainer", "user@example.com");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("LABEL");
      expect(result.value.key).toBe("maintainer");
      expect(result.value.value).toBe("user@example.com");
    }
  });

  it("returns Err for empty key", () => {
    const result = label("", "value");
    expect(result.isErr()).toBe(true);
  });
});

describe("arg()", () => {
  it("returns Ok for valid arg name", () => {
    const result = arg("VERSION");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("ARG");
      expect(result.value.name).toBe("VERSION");
      expect(result.value.defaultValue).toBeNull();
    }
  });

  it("accepts defaultValue option", () => {
    const result = arg("VERSION", { defaultValue: "1.0.0" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.defaultValue).toBe("1.0.0");
    }
  });

  it("returns Err for empty name", () => {
    const result = arg("");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("name");
    }
  });
});
