# containerfile-ts Implementation Plan - Phase 4: Rendering Logic

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Implement Dockerfile string rendering from instruction objects.

**Architecture:** Decomposed render functions per instruction type with a dispatch table for clean separation. Pure transformation from data to string.

**Tech Stack:** TypeScript with strict mode

**Scope:** Phase 4 of 8 from original design

**Codebase verified:** 2025-01-01 - Types and factory functions exist after Phases 2-3

---

## Task 4.1: Create render module

**Files:**
- Create: `src/render.ts`

**Step 1: Create render.ts with decomposed rendering functions**

```typescript
// pattern: Functional Core

import type {
  Instruction,
  Containerfile,
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
} from './types.js';

function renderFrom(instruction: FromInstruction): string {
  let line = 'FROM';
  if (instruction.platform !== null) {
    line += ` --platform=${instruction.platform}`;
  }
  line += ` ${instruction.image}`;
  if (instruction.as !== null) {
    line += ` AS ${instruction.as}`;
  }
  return line;
}

function renderRun(instruction: RunInstruction): string {
  if (typeof instruction.command === 'string') {
    return `RUN ${instruction.command}`;
  }
  return `RUN ${JSON.stringify(instruction.command)}`;
}

function renderCopy(instruction: CopyInstruction): string {
  let line = 'COPY';
  if (instruction.from !== null) {
    line += ` --from=${instruction.from}`;
  }
  if (instruction.chown !== null) {
    line += ` --chown=${instruction.chown}`;
  }
  if (instruction.chmod !== null) {
    line += ` --chmod=${instruction.chmod}`;
  }
  line += ` ${instruction.src} ${instruction.dest}`;
  return line;
}

function renderAdd(instruction: AddInstruction): string {
  let line = 'ADD';
  if (instruction.chown !== null) {
    line += ` --chown=${instruction.chown}`;
  }
  if (instruction.chmod !== null) {
    line += ` --chmod=${instruction.chmod}`;
  }
  line += ` ${instruction.src} ${instruction.dest}`;
  return line;
}

function renderWorkdir(instruction: WorkdirInstruction): string {
  return `WORKDIR ${instruction.path}`;
}

function renderEnv(instruction: EnvInstruction): string {
  return `ENV ${instruction.key}=${instruction.value}`;
}

function renderExpose(instruction: ExposeInstruction): string {
  const protocol = instruction.protocol === 'udp' ? '/udp' : '';
  return `EXPOSE ${instruction.port}${protocol}`;
}

function renderCmd(instruction: CmdInstruction): string {
  return `CMD ${JSON.stringify(instruction.command)}`;
}

function renderEntrypoint(instruction: EntrypointInstruction): string {
  return `ENTRYPOINT ${JSON.stringify(instruction.command)}`;
}

function renderArg(instruction: ArgInstruction): string {
  if (instruction.defaultValue !== null) {
    return `ARG ${instruction.name}=${instruction.defaultValue}`;
  }
  return `ARG ${instruction.name}`;
}

function renderLabel(instruction: LabelInstruction): string {
  return `LABEL ${instruction.key}="${instruction.value}"`;
}

/**
 * Renderer dispatch table - maps instruction type to render function
 */
const renderers: {
  readonly [K in Instruction['type']]: (instruction: Extract<Instruction, { type: K }>) => string;
} = {
  FROM: renderFrom,
  RUN: renderRun,
  COPY: renderCopy,
  ADD: renderAdd,
  WORKDIR: renderWorkdir,
  ENV: renderEnv,
  EXPOSE: renderExpose,
  CMD: renderCmd,
  ENTRYPOINT: renderEntrypoint,
  ARG: renderArg,
  LABEL: renderLabel,
};

/**
 * Renders a single instruction to its Dockerfile string representation
 */
export function renderInstruction(instruction: Instruction): string {
  const renderer = renderers[instruction.type] as (instruction: Instruction) => string;
  return renderer(instruction);
}

/**
 * Renders a Containerfile to its Dockerfile string representation
 */
export function render(containerfile: Containerfile): string {
  return containerfile.instructions
    .map(renderInstruction)
    .join('\n');
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/render.ts
git commit -m "feat: add render function for Dockerfile generation"
```

---

## Task 4.2: Export render from index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add render export to index.ts**

Add after the instructions export:

```typescript
export { render, renderInstruction } from './render.js';
```

**Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export render function from index"
```
