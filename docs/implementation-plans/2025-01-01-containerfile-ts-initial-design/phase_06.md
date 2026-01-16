# containerfile-ts Implementation Plan - Phase 6: Testing Infrastructure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Set up vitest with fixture-based testing pattern.

**Architecture:** Fixture-based testing where each fixture directory contains an expected.Dockerfile and a generator.ts. The test runner discovers fixtures, runs generators, and compares output to expected files.

**Tech Stack:** vitest 2.1+, TypeScript

**Scope:** Phase 6 of 8 from original design

**Codebase verified:** 2025-01-01 - All library code exists after Phases 1-5

---

## Task 6.1: Add vitest dependency and configuration

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Add vitest to package.json devDependencies**

Add to devDependencies:

```json
"devDependencies": {
  "typescript": "^5.7.0",
  "vitest": "^2.1.0"
}
```

Add test script to scripts:

```json
"scripts": {
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

**Step 3: Install dependencies**

Run: `pnpm install`
Expected: vitest installed

**Step 4: Commit**

```bash
git add package.json vitest.config.ts pnpm-lock.yaml
git commit -m "chore: add vitest for testing"
```

---

## Task 6.2: Create simple-node fixture

**Files:**

- Create: `tests/fixtures/simple-node/expected.Dockerfile`
- Create: `tests/fixtures/simple-node/generator.ts`

**Step 1: Create expected.Dockerfile for simple Node.js app**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Step 2: Create generator.ts that produces the expected output**

```typescript
// pattern: Functional Core

import { containerfile, from, workdir, copy, run, expose, cmd } from "../../../src/index.js";

export const fixture = containerfile({
  instructions: [
    from("node:20-alpine"),
    workdir("/app"),
    copy("package*.json", "."),
    run("npm ci"),
    copy(".", "."),
    expose(3000),
    cmd(["node", "dist/index.js"]),
  ],
});
```

**Step 3: Commit**

```bash
git add tests/fixtures/simple-node/
git commit -m "test: add simple-node fixture"
```

---

## Task 6.3: Create multi-stage-node fixture

**Files:**

- Create: `tests/fixtures/multi-stage-node/expected.Dockerfile`
- Create: `tests/fixtures/multi-stage-node/generator.ts`

**Step 1: Create expected.Dockerfile for multi-stage Node.js build**

```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

**Step 2: Create generator.ts that produces the expected output**

```typescript
// pattern: Functional Core

import { containerfile, stage, from, workdir, copy, run, cmd } from "../../../src/index.js";

export const fixture = containerfile({
  stages: [
    stage("builder", [
      from("node:20", { as: "builder" }),
      workdir("/app"),
      copy("package*.json", "."),
      run("npm ci"),
      copy(".", "."),
      run("npm run build"),
    ]),
    stage("runtime", [
      from("node:20-alpine", { as: "runtime" }),
      workdir("/app"),
      copy("/app/dist", "./dist", { from: "builder" }),
      copy("/app/node_modules", "./node_modules", { from: "builder" }),
      cmd(["node", "dist/index.js"]),
    ]),
  ],
});
```

**Step 3: Commit**

```bash
git add tests/fixtures/multi-stage-node/
git commit -m "test: add multi-stage-node fixture"
```

---

## Task 6.4: Create fixture discovery test

**Files:**

- Create: `tests/generation.test.ts`

**Step 1: Create generation.test.ts with fixture discovery and comparison**

```typescript
// pattern: Imperative Shell

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render } from "../src/index.js";

const fixturesDir = join(import.meta.dirname, "fixtures");

function getFixtureDirs(): Array<string> {
  return readdirSync(fixturesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

describe("Dockerfile generation", () => {
  const fixtures = getFixtureDirs();

  for (const fixtureName of fixtures) {
    it(`generates correct output for ${fixtureName}`, async () => {
      const fixtureDir = join(fixturesDir, fixtureName);

      // Load the generator
      const generatorPath = join(fixtureDir, "generator.ts");
      const { fixture } = await import(generatorPath);

      // Load the expected output
      const expectedPath = join(fixtureDir, "expected.Dockerfile");
      const expected = readFileSync(expectedPath, "utf-8").trim();

      // Generate and compare
      const generated = render(fixture);

      expect(generated).toBe(expected);
    });
  }
});
```

**Step 2: Verify tests run**

Run: `pnpm test`
Expected: 2 tests pass (simple-node, multi-stage-node)

**Step 3: Commit**

```bash
git add tests/generation.test.ts
git commit -m "test: add fixture-based generation tests"
```
