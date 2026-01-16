# containerfile-ts Implementation Plan - Phase 3: Factory Functions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Implement factory functions for creating instruction objects.

**Architecture:** Factory functions provide ergonomic API for creating typed instruction objects. Optional parameters use FooOptions pattern. Validation at construction time for invalid inputs.

**Tech Stack:** TypeScript with strict mode

**Scope:** Phase 3 of 8 from original design

**Codebase verified:** 2025-01-01 - Types defined in src/types.ts after Phase 2

---

## Task 3.1: Create factory function option types

**Files:**

- Modify: `src/types.ts`

**Step 1: Add option types for factory functions**

Add to the end of `src/types.ts`:

```typescript
/**
 * Options for the from() factory function
 */
export type FromOptions = {
  readonly as?: string;
  readonly platform?: string;
};

/**
 * Options for the copy() factory function
 */
export type CopyOptions = {
  readonly from?: string;
  readonly chown?: string;
  readonly chmod?: string;
};

/**
 * Options for the add() factory function
 */
export type AddOptions = {
  readonly chown?: string;
  readonly chmod?: string;
};

/**
 * Options for the expose() factory function
 */
export type ExposeOptions = {
  readonly protocol?: "tcp" | "udp";
};

/**
 * Options for the arg() factory function
 */
export type ArgOptions = {
  readonly defaultValue?: string;
};
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add option types for factory functions"
```

---

## Task 3.2: Create factory functions

**Files:**

- Create: `src/instructions.ts`

**Step 1: Create instructions.ts with all factory functions**

```typescript
// pattern: Functional Core

import type {
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
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
} from "./types.js";

/**
 * Creates a FROM instruction
 */
export function from(image: string, options?: FromOptions): FromInstruction {
  return {
    type: "FROM",
    image,
    as: options?.as ?? null,
    platform: options?.platform ?? null,
  };
}

/**
 * Creates a RUN instruction
 */
export function run(command: string | ReadonlyArray<string>): RunInstruction {
  return {
    type: "RUN",
    command,
  };
}

/**
 * Creates a COPY instruction
 */
export function copy(src: string, dest: string, options?: CopyOptions): CopyInstruction {
  return {
    type: "COPY",
    src,
    dest,
    from: options?.from ?? null,
    chown: options?.chown ?? null,
    chmod: options?.chmod ?? null,
  };
}

/**
 * Creates an ADD instruction
 */
export function add(src: string, dest: string, options?: AddOptions): AddInstruction {
  return {
    type: "ADD",
    src,
    dest,
    chown: options?.chown ?? null,
    chmod: options?.chmod ?? null,
  };
}

/**
 * Creates a WORKDIR instruction
 */
export function workdir(path: string): WorkdirInstruction {
  return {
    type: "WORKDIR",
    path,
  };
}

/**
 * Creates an ENV instruction
 */
export function env(key: string, value: string): EnvInstruction {
  return {
    type: "ENV",
    key,
    value,
  };
}

/**
 * Creates an EXPOSE instruction
 */
export function expose(port: number, options?: ExposeOptions): ExposeInstruction {
  if (port < 0 || port > 65535) {
    throw new Error(`invalid port number: ${port} (must be 0-65535)`);
  }
  return {
    type: "EXPOSE",
    port,
    protocol: options?.protocol ?? "tcp",
  };
}

/**
 * Creates a CMD instruction
 */
export function cmd(command: ReadonlyArray<string>): CmdInstruction {
  return {
    type: "CMD",
    command,
  };
}

/**
 * Creates an ENTRYPOINT instruction
 */
export function entrypoint(command: ReadonlyArray<string>): EntrypointInstruction {
  return {
    type: "ENTRYPOINT",
    command,
  };
}

/**
 * Creates an ARG instruction
 */
export function arg(name: string, options?: ArgOptions): ArgInstruction {
  return {
    type: "ARG",
    name,
    defaultValue: options?.defaultValue ?? null,
  };
}

/**
 * Creates a LABEL instruction
 */
export function label(key: string, value: string): LabelInstruction {
  return {
    type: "LABEL",
    key,
    value,
  };
}

/**
 * Identity function for creating a Containerfile definition
 * Provides type safety and IDE autocompletion
 */
export function containerfile(def: Containerfile): Containerfile {
  return def;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/instructions.ts
git commit -m "feat: add factory functions for all instructions"
```

---

## Task 3.3: Export factory functions from index.ts

**Files:**

- Modify: `src/index.ts`

**Step 1: Update index.ts to export factory functions**

Replace contents with:

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
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
} from "./types.js";

export {
  from,
  run,
  copy,
  add,
  workdir,
  env,
  expose,
  cmd,
  entrypoint,
  arg,
  label,
  containerfile,
} from "./instructions.js";
```

**Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export factory functions from index"
```
