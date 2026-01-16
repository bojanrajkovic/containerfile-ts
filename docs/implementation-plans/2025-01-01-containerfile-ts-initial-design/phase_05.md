# containerfile-ts Implementation Plan - Phase 5: Multi-Stage Support

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Add stage grouping and multi-stage containerfile support with unified API.

**Architecture:** Unified Containerfile type using structural discrimination - single `containerfile` and `render` functions handle both single-stage (`instructions` property) and multi-stage (`stages` property) builds.

**Tech Stack:** TypeScript with strict mode

**Scope:** Phase 5 of 8 from original design

**Codebase verified:** 2025-01-01 - Types, factory functions, and render exist after Phases 2-4

---

## Task 5.1: Update Containerfile type for unified API

**Files:**

- Modify: `src/types.ts`

**Step 1: Replace Containerfile type with unified definition**

Replace the existing Containerfile type and add Stage:

```typescript
/**
 * A named stage in a multi-stage build
 */
export type Stage = {
  readonly name: string;
  readonly instructions: ReadonlyArray<Instruction>;
};

/**
 * A Containerfile definition - either single-stage (instructions) or multi-stage (stages)
 */
export type Containerfile =
  | { readonly instructions: ReadonlyArray<Instruction> }
  | { readonly stages: ReadonlyArray<Stage> };
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: unify Containerfile type for single and multi-stage builds"
```

---

## Task 5.2: Create stage factory function

**Files:**

- Create: `src/stage.ts`

**Step 1: Create stage.ts with stage factory**

```typescript
// pattern: Functional Core

import type { Instruction, Stage } from "./types.js";

/**
 * Creates a named stage for multi-stage builds
 */
export function stage(name: string, instructions: ReadonlyArray<Instruction>): Stage {
  return {
    name,
    instructions,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/stage.ts
git commit -m "feat: add stage factory function"
```

---

## Task 5.3: Update render for unified Containerfile

**Files:**

- Modify: `src/render.ts`

**Step 1: Update imports in render.ts**

```typescript
import type {
  Instruction,
  Containerfile,
  Stage,
  FromInstruction,
  RunInstruction,
  CopyInstruction,
  AddInstruction,
  WorkdirInstruction,
  EnvInstruction,
  ExposeInstruction,
  CmdInstruction,
  EntrypointInstruction,
  ArgInstruction,
  LabelInstruction,
} from "./types.js";
```

**Step 2: Add stage rendering helper and update render function**

Add after renderInstruction:

```typescript
/**
 * Renders a Stage to its Dockerfile string representation
 */
function renderStage(stageToRender: Stage): string {
  return stageToRender.instructions.map(renderInstruction).join("\n");
}

/**
 * Type guard for single-stage containerfile
 */
function isSingleStage(
  containerfile: Containerfile,
): containerfile is { readonly instructions: ReadonlyArray<Instruction> } {
  return "instructions" in containerfile;
}

/**
 * Renders a Containerfile to its Dockerfile string representation
 * Handles both single-stage and multi-stage builds
 */
export function render(containerfile: Containerfile): string {
  if (isSingleStage(containerfile)) {
    return containerfile.instructions.map(renderInstruction).join("\n");
  }

  return containerfile.stages.map(renderStage).join("\n\n");
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/render.ts
git commit -m "feat: update render to handle both single and multi-stage builds"
```

---

## Task 5.4: Export stage from index.ts

**Files:**

- Modify: `src/index.ts`

**Step 1: Update index.ts with stage exports**

Add Stage to type exports:

```typescript
export type {
  Instruction,
  FromInstruction,
  RunInstruction,
  CopyInstruction,
  AddInstruction,
  WorkdirInstruction,
  EnvInstruction,
  ExposeInstruction,
  CmdInstruction,
  EntrypointInstruction,
  ArgInstruction,
  LabelInstruction,
  Containerfile,
  Stage,
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
} from "./types.js";
```

Add stage export:

```typescript
export { stage } from "./stage.js";
```

**Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export stage from index"
```
