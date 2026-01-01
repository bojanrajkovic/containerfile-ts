# containerfile-ts Implementation Plan - Phase 2: Core Instruction Types

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Define TypeScript types for all supported Dockerfile instructions.

**Architecture:** Discriminated union with `type` field enables exhaustive pattern matching. All types use `readonly` properties and `null` for absent optional values.

**Tech Stack:** TypeScript with strict mode

**Scope:** Phase 2 of 8 from original design

**Codebase verified:** 2025-01-01 - Phase 1 scaffolding will exist, need to create src/types.ts

---

## Task 2.1: Create Dockerfile instruction types

**Files:**
- Create: `src/types.ts`

**Step 1: Create types.ts with all instruction types**

```typescript
// pattern: Functional Core

/**
 * FROM instruction - specifies base image
 */
export type FromInstruction = {
  readonly type: 'FROM';
  readonly image: string;
  readonly as: string | null;
  readonly platform: string | null;
};

/**
 * RUN instruction - executes commands
 */
export type RunInstruction = {
  readonly type: 'RUN';
  readonly command: string | ReadonlyArray<string>;
};

/**
 * COPY instruction - copies files from build context or other stages
 */
export type CopyInstruction = {
  readonly type: 'COPY';
  readonly src: string;
  readonly dest: string;
  readonly from: string | null;
  readonly chown: string | null;
  readonly chmod: string | null;
};

/**
 * ADD instruction - copies files with URL/archive support
 */
export type AddInstruction = {
  readonly type: 'ADD';
  readonly src: string;
  readonly dest: string;
  readonly chown: string | null;
  readonly chmod: string | null;
};

/**
 * WORKDIR instruction - sets working directory
 */
export type WorkdirInstruction = {
  readonly type: 'WORKDIR';
  readonly path: string;
};

/**
 * ENV instruction - sets environment variables
 */
export type EnvInstruction = {
  readonly type: 'ENV';
  readonly key: string;
  readonly value: string;
};

/**
 * EXPOSE instruction - documents exposed ports
 */
export type ExposeInstruction = {
  readonly type: 'EXPOSE';
  readonly port: number;
  readonly protocol: 'tcp' | 'udp';
};

/**
 * CMD instruction - default command
 */
export type CmdInstruction = {
  readonly type: 'CMD';
  readonly command: ReadonlyArray<string>;
};

/**
 * ENTRYPOINT instruction - container entrypoint
 */
export type EntrypointInstruction = {
  readonly type: 'ENTRYPOINT';
  readonly command: ReadonlyArray<string>;
};

/**
 * ARG instruction - build-time variable
 */
export type ArgInstruction = {
  readonly type: 'ARG';
  readonly name: string;
  readonly defaultValue: string | null;
};

/**
 * LABEL instruction - metadata
 */
export type LabelInstruction = {
  readonly type: 'LABEL';
  readonly key: string;
  readonly value: string;
};

/**
 * Discriminated union of all Dockerfile instructions
 */
export type Instruction =
  | FromInstruction
  | RunInstruction
  | CopyInstruction
  | AddInstruction
  | WorkdirInstruction
  | EnvInstruction
  | ExposeInstruction
  | CmdInstruction
  | EntrypointInstruction
  | ArgInstruction
  | LabelInstruction;

/**
 * A complete Containerfile definition
 */
export type Containerfile = {
  readonly instructions: ReadonlyArray<Instruction>;
};
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core Dockerfile instruction types"
```

---

## Task 2.2: Export types from index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Update index.ts to export types**

```typescript
// pattern: Functional Core
// Entry point for containerfile-ts library

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
} from './types.js';
```

**Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build succeeds with type exports in dist/

**Step 3: Verify types are accessible**

Run: `cat dist/index.d.ts`
Expected: All type exports visible in declaration file

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: export instruction types from index"
```
