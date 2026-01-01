# containerfile-ts

> Freshness: 2026-01-01

TypeScript library for generating Containerfiles/Dockerfiles programmatically using type-safe declarative object literals.

## Quick Start

```bash
pnpm install    # Install dependencies
pnpm build      # Build TypeScript
pnpm test       # Run tests
pnpm test:watch # Run tests in watch mode
```

## Architecture

### FCIS Pattern

This library follows the Functional Core, Imperative Shell pattern:

- **Functional Core** (`src/types.ts`, `src/instructions.ts`): Pure types and factory functions with no I/O
- **Imperative Shell** (future `src/render.ts`): String rendering and file output

### File Structure

```
src/
  index.ts        # Public API exports
  types.ts        # All instruction types and option types
  instructions.ts # Factory functions for creating instructions
tests/
  generation.test.ts  # Fixture-based generation tests
  fixtures/           # Test fixtures with generator.ts and expected.Dockerfile
```

## Public API Contracts

### Instruction Types

Discriminated union with `type` field for exhaustive pattern matching:

```typescript
type Instruction =
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
```

All instruction types use:
- `readonly` fields for immutability
- `null` for absent optional values (not `undefined`)
- `ReadonlyArray<T>` for array fields

### Factory Functions

Factory functions create instruction objects with optional parameters via option objects:

| Function | Signature | Notes |
|----------|-----------|-------|
| `from` | `(image: string, options?: FromOptions)` | `as`, `platform` options |
| `run` | `(command: string \| ReadonlyArray<string>)` | Shell or exec form |
| `copy` | `(src: string \| ReadonlyArray<string>, dest: string, options?: CopyOptions)` | `from`, `chown`, `chmod` options |
| `add` | `(src: string \| ReadonlyArray<string>, dest: string, options?: AddOptions)` | `chown`, `chmod` options |
| `workdir` | `(path: string)` | |
| `env` | `(key: string, value: string)` | |
| `expose` | `(port: number \| {start, end}, options?: ExposeOptions)` | Validates port range 0-65535, `protocol` option |
| `cmd` | `(command: ReadonlyArray<string>)` | Exec form only |
| `entrypoint` | `(command: ReadonlyArray<string>)` | Exec form only |
| `arg` | `(name: string, options?: ArgOptions)` | `defaultValue` option |
| `label` | `(key: string, value: string)` | |
| `containerfile` | `(def: Containerfile)` | Identity function for type safety |

### Validation

The `expose()` function validates:
- Port numbers are integers
- Port numbers are in range 0-65535
- Port range start <= end

Throws `Error` with descriptive message on invalid input.

## TypeScript Conventions

- Use `type` over `interface`
- Use `ReadonlyArray<T>` for immutable arrays
- Use `null` for absent values, not `undefined`
- All fields are `readonly`
- Strict TypeScript configuration

## Testing

Tests use Vitest with a fixture-based approach:

- Each fixture has a `generator.ts` exporting a `fixture` containerfile definition
- Each fixture has an `expected.Dockerfile` with the expected rendered output
- Tests dynamically discover fixtures and verify generation matches expected output

To add a new test fixture:
1. Create `tests/fixtures/<fixture-name>/generator.ts`
2. Create `tests/fixtures/<fixture-name>/expected.Dockerfile`
3. Export `fixture` from the generator file

## Implementation Status

- Phase 1: Project Scaffolding - Complete
- Phase 2: Core Instruction Types - Complete
- Phase 3: Factory Functions - Complete
- Phase 4: Rendering Logic - Not started
- Phase 5: Multi-Stage Support - Not started
- Phase 6: Testing Infrastructure - Complete
- Phase 7: Linting and Git Hooks - Not started
- Phase 8: Documentation - In progress
