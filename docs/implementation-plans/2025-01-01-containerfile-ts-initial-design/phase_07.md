# containerfile-ts Implementation Plan - Phase 7: Linting and Git Hooks

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Configure oxlint and Husky for code quality enforcement.

**Architecture:** Minimal oxlint configuration using defaults with ignore patterns. Husky hooks run lint --fix on commit and typecheck + tests on push.

**Tech Stack:** oxlint 0.15+, husky 9.1+

**Scope:** Phase 7 of 8 from original design

**Codebase verified:** 2025-01-01 - Library code and tests exist after Phases 1-6

---

## Task 7.1: Add oxlint dependency and configuration

**Files:**
- Modify: `package.json`
- Create: `oxlint.json`

**Step 1: Add oxlint to package.json devDependencies**

Add to devDependencies:

```json
"devDependencies": {
  "oxlint": "^0.15.0",
  "typescript": "^5.7.0",
  "vitest": "^2.1.0"
}
```

Add lint script to scripts:

```json
"scripts": {
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "oxlint",
  "lint:fix": "oxlint --fix"
}
```

**Step 2: Create minimal oxlint.json configuration**

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "ignorePatterns": ["dist", "node_modules"]
}
```

**Step 3: Install dependencies and verify lint runs**

Run: `pnpm install && pnpm lint`
Expected: Lint runs without errors

**Step 4: Commit**

```bash
git add package.json oxlint.json pnpm-lock.yaml
git commit -m "chore: add oxlint for code quality"
```

---

## Task 7.2: Add husky for git hooks

**Files:**
- Modify: `package.json`
- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`

**Step 1: Add husky to package.json devDependencies**

Add to devDependencies:

```json
"husky": "^9.1.0"
```

Add prepare script:

```json
"scripts": {
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "oxlint",
  "lint:fix": "oxlint --fix",
  "prepare": "husky"
}
```

**Step 2: Install husky and initialize**

Run: `pnpm install && pnpm exec husky init`
Expected: .husky directory created

**Step 3: Create pre-commit hook**

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
pnpm lint:fix
```

**Step 4: Create pre-push hook**

Create `.husky/pre-push`:

```bash
#!/usr/bin/env sh
pnpm typecheck && pnpm test
```

**Step 5: Make hooks executable**

Run: `chmod +x .husky/pre-commit .husky/pre-push`
Expected: Hooks are executable

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .husky/
git commit -m "chore: add husky git hooks for lint and test"
```

---

## Task 7.3: Verify hooks work

**Step 1: Test pre-commit hook**

Run: `git commit --allow-empty -m "test: verify pre-commit hook"`
Expected: oxlint --fix runs before commit

**Step 2: Verify lint runs on existing code**

Run: `pnpm lint`
Expected: No errors on src/ and tests/
