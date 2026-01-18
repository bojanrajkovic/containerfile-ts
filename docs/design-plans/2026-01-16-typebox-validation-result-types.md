# TypeBox Validation and Result Types Design

## Overview

Enhance API safety by combining TypeBox runtime validation with neverthrow Result types. All factory functions will validate inputs and return `Result<Instruction, ValidationError[]>` instead of throwing or returning raw instruction types.

**Goals:**

- Catch invalid values at construction time, not render time
- Provide explicit error handling with all validation errors collected
- Maintain type-level guarantees via branded types
- Simplify containerfile API while adding safety

**Scope:** Issues #12 (TypeBox validation) and #13 (neverthrow Results) combined into single breaking change.

## Architecture

Layered schema architecture with three tiers:

```
┌─────────────────────────────────────────────────────────┐
│                    Public API Layer                     │
│  containerfile(), from(), run(), copy(), expose(), ...  │
│  Returns: Result<T, ValidationError[]>                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│               Instruction Schema Layer                  │
│  Composes primitive schemas into instruction validation │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Primitive Schema Layer                   │
│  PortSchema, ImageNameSchema, DockerPathSchema          │
│  Branded types: Port, ImageName, DockerPath             │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**

- Primitive schemas compiled once at module load via `TypeCompiler.Compile()`
- Branded types via `Type.Unsafe<BrandedType>(schema)` pattern
- Factory functions validate and return `Result<Instruction, ValidationError[]>`
- `containerfile()` uses `Result.combineWithAllErrors()` to collect all errors
- `render()` unchanged - accepts valid Containerfile, returns string

## Contracts

**ValidationError type:**

```typescript
type ValidationError = {
  readonly field: string; // e.g., "port", "image", "instructions[2].src"
  readonly message: string; // Human-readable error
  readonly value: unknown; // The invalid value
};
```

**Branded primitive types:**

```typescript
type Port = number & { readonly __brand: "Port" };
type ImageName = string & { readonly __brand: "ImageName" };
type DockerPath = string & { readonly __brand: "DockerPath" };
```

**Updated factory signatures:**

```typescript
function from(image: string, options?: FromOptions): Result<FromInstruction, ValidationError[]>;
function run(command: string | ReadonlyArray<string>): Result<RunInstruction, ValidationError[]>;
function copy(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: CopyOptions,
): Result<CopyInstruction, ValidationError[]>;
function expose(
  port: number | PortRange,
  options?: ExposeOptions,
): Result<ExposeInstruction, ValidationError[]>;
// ... all 11 factory functions follow same pattern

function stage(
  name: string,
  instructions: ReadonlyArray<Result<Instruction, ValidationError[]>>,
): Result<Stage, ValidationError[]>;
```

**Simplified containerfile API:**

```typescript
// Single-stage: array of instruction Results
function containerfile(
  instructions: ReadonlyArray<Result<Instruction, ValidationError[]>>,
): Result<Containerfile, ValidationError[]>;

// Multi-stage: array of stage Results
function containerfile(
  stages: ReadonlyArray<Result<Stage, ValidationError[]>>,
): Result<Containerfile, ValidationError[]>;
```

## Existing Patterns

Investigation found one existing validation pattern:

- `expose()` in `src/instructions.ts:112-145` validates port ranges via `validatePort()` helper
- Current pattern throws `Error` on invalid input

This design replaces the throw pattern with Result types across all factory functions. The validation logic (integer check, range 0-65535) moves into TypeBox schemas.

All existing code follows FCIS pattern (`// pattern: Functional Core`). This design maintains that - schemas and validation are pure, Results are values not side effects.

## Implementation Phases

### Phase 1: Dependencies and Infrastructure

**Goal:** Add TypeBox and neverthrow dependencies, create schema infrastructure

**Components:**

- `package.json` — add `@sinclair/typebox` and `neverthrow` as dependencies
- `src/schemas/primitives.ts` — Port, ImageName, DockerPath schemas with branded types
- `src/schemas/index.ts` — re-exports
- `src/errors.ts` — ValidationError type and error collection helpers

**Dependencies:** None

**Done when:** `pnpm install` succeeds, `pnpm build` succeeds, primitive schemas compile

### Phase 2: Core Validation Functions

**Goal:** Validation helpers that wrap TypeBox and return Results

**Components:**

- Validation functions in `src/schemas/primitives.ts` — `validatePort()`, `validateImageName()`, `validatePath()` returning `Result<BrandedType, ValidationError[]>`
- Compiled validators using `TypeCompiler.Compile()` for performance
- Tests for each primitive validator covering valid/invalid cases

**Dependencies:** Phase 1

**Done when:** All primitive validators work, tests pass for valid inputs, invalid inputs return appropriate errors

### Phase 3: Factory Function Migration

**Goal:** Update all factory functions to return Result types

**Components:**

- `src/instructions.ts` — all 11 factory functions updated to return `Result<Instruction, ValidationError[]>`
- Remove throwing `validatePort()` helper, use schema validation instead
- `src/stage.ts` — `stage()` function returns `Result<Stage, ValidationError[]>`
- Tests updated to handle Result types

**Dependencies:** Phase 2

**Done when:** All factory functions return Results, existing fixture tests pass (with Result unwrapping), new error case tests pass

### Phase 4: Containerfile API Simplification

**Goal:** Simplify containerfile() to accept arrays directly and handle Result combining

**Components:**

- `src/instructions.ts` — `containerfile()` accepts `ReadonlyArray<Result<Instruction, ...>>` or `ReadonlyArray<Result<Stage, ...>>`
- Error prefixing logic — adds `instructions[N].` or `stages[N].` prefix to nested errors
- Uses `Result.combineWithAllErrors()` for error collection
- `src/types.ts` — update Containerfile type if needed

**Dependencies:** Phase 3

**Done when:** New containerfile API works, errors from multiple instructions collected with correct field paths, tests pass

### Phase 5: Public API and Exports

**Goal:** Update public exports and documentation

**Components:**

- `src/index.ts` — export ValidationError, re-export `ok`, `err`, `Result` from neverthrow
- Update any JSDoc comments on public functions
- `CLAUDE.md` — update API contracts section to reflect new signatures

**Dependencies:** Phase 4

**Done when:** All public types exported, build succeeds, all tests pass

### Phase 6: Property-Based Testing

**Goal:** Add property-based tests for schema validation

**Components:**

- Property tests for PortSchema — roundtrip, boundary conditions
- Property tests for ImageNameSchema — valid format acceptance, invalid rejection
- Property tests for DockerPathSchema — non-empty validation

**Dependencies:** Phase 5

**Done when:** Property tests pass, edge cases covered by generated inputs

## Additional Considerations

**Breaking changes:**

1. All factory functions return `Result<T, ValidationError[]>` instead of `T`
2. `containerfile({ instructions: [...] })` becomes `containerfile([...])`
3. `expose()` no longer throws — returns Result like other functions
4. Users must handle Results via `.match()`, `.map()`, `.unwrapOr()`, etc.

**Migration path for users:**

```typescript
// Before
const cf = containerfile({ instructions: [from("node:18"), run("npm install")] });
render(cf);

// After
containerfile([from("node:18"), run("npm install")]).match(
  (cf) => console.log(render(cf)),
  (errors) => console.error(errors),
);
```

**Image name validation:** Uses Docker registry format pattern supporting:

- Simple names: `nginx`, `node`
- Registry paths: `ghcr.io/user/app`
- Tags: `node:18`, `nginx:latest`
- Digests: `nginx@sha256:abc...`
