// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import {
  from,
  workdir,
  env,
  label,
  arg,
  run,
  cmd,
  entrypoint,
  copy,
  add,
  expose,
  containerfile,
} from "../src/instructions.js";
import { stage } from "../src/stage.js";
import { Result } from "neverthrow";
import type { Stage } from "../src/types.js";
import type { ValidationError } from "../src/errors.js";

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

  it("returns Err for non-string value at runtime", () => {
    // Simulate runtime data from JSON parsing or external sources
    const result = env("KEY", 123 as unknown as string);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("value");
      expect(result.error[0].message).toContain("string");
    }
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

  it("returns Err for non-string value at runtime", () => {
    // Simulate runtime data from JSON parsing or external sources
    const result = label("version", { obj: true } as unknown as string);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("value");
      expect(result.error[0].message).toContain("string");
    }
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

  it("returns Err for non-string defaultValue at runtime", () => {
    // Simulate runtime data from JSON parsing or external sources
    const result = arg("VERSION", { defaultValue: 42 as unknown as string });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("defaultValue");
      expect(result.error[0].message).toContain("non-empty string");
    }
  });

  it("returns Err for empty defaultValue", () => {
    const result = arg("VERSION", { defaultValue: "" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("defaultValue");
    }
  });
});

describe("run()", () => {
  it("returns Ok for shell form string", () => {
    const result = run("npm install");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("RUN");
      expect(result.value.command).toBe("npm install");
    }
  });

  it("returns Ok for exec form array", () => {
    const result = run(["npm", "install"]);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.command).toEqual(["npm", "install"]);
    }
  });

  it("returns Err for empty string", () => {
    const result = run("");
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for empty array", () => {
    const result = run([]);
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for array with empty string", () => {
    const result = run(["npm", ""]);
    expect(result.isErr()).toBe(true);
  });
});

describe("cmd()", () => {
  it("returns Ok for valid command array", () => {
    const result = cmd(["node", "server.js"]);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("CMD");
      expect(result.value.command).toEqual(["node", "server.js"]);
    }
  });

  it("returns Err for empty array", () => {
    const result = cmd([]);
    expect(result.isErr()).toBe(true);
  });
});

describe("entrypoint()", () => {
  it("returns Ok for valid command array", () => {
    const result = entrypoint(["docker-entrypoint.sh"]);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("ENTRYPOINT");
      expect(result.value.command).toEqual(["docker-entrypoint.sh"]);
    }
  });

  it("returns Err for empty array", () => {
    const result = entrypoint([]);
    expect(result.isErr()).toBe(true);
  });
});

describe("copy()", () => {
  it("returns Ok for single source and dest", () => {
    const result = copy("package.json", "/app/");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("COPY");
      expect(result.value.src).toEqual(["package.json"]);
      expect(result.value.dest).toBe("/app/");
    }
  });

  it("returns Ok for multiple sources", () => {
    const result = copy(["package.json", "package-lock.json"], "/app/");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.src).toEqual(["package.json", "package-lock.json"]);
    }
  });

  it("accepts from option", () => {
    const result = copy("./dist", "/app/", { from: "builder" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.from).toBe("builder");
    }
  });

  it("accepts chown option", () => {
    const result = copy(".", "/app/", { chown: "node:node" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.chown).toBe("node:node");
    }
  });

  it("accepts chmod option", () => {
    const result = copy("entrypoint.sh", "/", { chmod: "755" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.chmod).toBe("755");
    }
  });

  it("returns Err for empty source", () => {
    const result = copy("", "/app/");
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for empty dest", () => {
    const result = copy("file.txt", "");
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for empty source in array", () => {
    const result = copy(["valid.txt", ""], "/app/");
    expect(result.isErr()).toBe(true);
  });

  it("collects multiple errors", () => {
    const result = copy("", "");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("add()", () => {
  it("returns Ok for valid source and dest", () => {
    const result = add("https://example.com/file.tar.gz", "/app/");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("ADD");
      expect(result.value.src).toEqual(["https://example.com/file.tar.gz"]);
      expect(result.value.dest).toBe("/app/");
    }
  });

  it("accepts chown option", () => {
    const result = add("file.tar.gz", "/app/", { chown: "1000:1000" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.chown).toBe("1000:1000");
    }
  });

  it("returns Err for empty source", () => {
    const result = add("", "/app/");
    expect(result.isErr()).toBe(true);
  });
});

describe("expose()", () => {
  it("returns Ok for valid port number", () => {
    const result = expose(8080);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.type).toBe("EXPOSE");
      expect(result.value.port).toBe(8080);
      expect(result.value.endPort).toBeNull();
      expect(result.value.protocol).toBeNull();
    }
  });

  it("returns Ok for port range", () => {
    const result = expose({ start: 8080, end: 8090 });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.port).toBe(8080);
      expect(result.value.endPort).toBe(8090);
    }
  });

  it("accepts protocol option", () => {
    const result = expose(53, { protocol: "udp" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.protocol).toBe("udp");
    }
  });

  it("returns Err for invalid port number", () => {
    const result = expose(70000);
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for negative port", () => {
    const result = expose(-1);
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for non-integer port", () => {
    const result = expose(80.5);
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for port range where start > end", () => {
    const result = expose({ start: 9000, end: 8000 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].message).toContain("start");
    }
  });

  it("collects all errors for invalid range", () => {
    const result = expose({ start: -1, end: 70000 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("stage()", () => {
  it("returns Ok for valid stage with Ok instructions", () => {
    const result = stage("builder", [from("node:18"), run("npm install")]);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe("builder");
      expect(result.value.instructions.length).toBe(2);
    }
  });

  it("returns Err for empty name", () => {
    const result = stage("", [from("node:18")]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("name");
    }
  });

  it("returns Err for empty instructions array", () => {
    const result = stage("builder", []);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0].field).toBe("instructions");
    }
  });

  it("collects errors from multiple Err instructions", () => {
    const result = stage("builder", [
      from(""), // Err
      run("npm install"), // Ok
      copy("", ""), // Err with 2 errors
    ]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      // Should have errors from from("") and copy("", "")
      expect(result.error.length).toBeGreaterThanOrEqual(3);
      // Errors should be prefixed with index
      expect(result.error.some((e) => e.field.startsWith("instructions[0]"))).toBe(true);
      expect(result.error.some((e) => e.field.startsWith("instructions[2]"))).toBe(true);
    }
  });

  it("collects all errors including name error", () => {
    const result = stage("", [from("")]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      // Should have name error and instruction error
      expect(result.error.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("containerfile()", () => {
  describe("single-stage (array of instruction Results)", () => {
    it("returns Ok for all Ok instructions", () => {
      const result = containerfile([from("node:18"), workdir("/app"), run("npm install")]);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect("instructions" in result.value).toBe(true);
        if ("instructions" in result.value) {
          expect(result.value.instructions.length).toBe(3);
        }
      }
    });

    it("returns Err for empty array", () => {
      const result = containerfile([]);
      expect(result.isErr()).toBe(true);
    });

    it("collects all errors from Err instructions", () => {
      const result = containerfile([
        from(""), // Err
        run("npm install"), // Ok
        expose(-1), // Err
      ]);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.length).toBeGreaterThanOrEqual(2);
        // Errors should be prefixed with instruction index
        expect(result.error.some((e) => e.field.startsWith("instructions[0]"))).toBe(true);
        expect(result.error.some((e) => e.field.startsWith("instructions[2]"))).toBe(true);
      }
    });
  });

  describe("multi-stage (array of stage Results)", () => {
    it("returns Ok for all Ok stages", () => {
      const result = containerfile([
        stage("builder", [from("node:18"), run("npm install")]),
        stage("runner", [from("node:18-slim"), copy(".", "/app", { from: "builder" })]),
      ]);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect("stages" in result.value).toBe(true);
        if ("stages" in result.value) {
          expect(result.value.stages.length).toBe(2);
        }
      }
    });

    it("returns Err for empty stages array", () => {
      const stagesResult: Array<Result<Stage, Array<ValidationError>>> = [];
      const result = containerfile(stagesResult);
      expect(result.isErr()).toBe(true);
    });

    it("collects all errors from Err stages", () => {
      const result = containerfile([
        stage("builder", [from("")]), // Err - invalid from
        stage("runner", [from("nginx")]), // Ok
      ]);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        // Error should be prefixed with stage index
        expect(result.error.some((e) => e.field.startsWith("stages[0]"))).toBe(true);
      }
    });
  });
});
