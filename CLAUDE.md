# containerfile-ts

> Freshness: 2026-01-01

Type-safe Dockerfile/Containerfile generation with declarative TypeScript.

## Quick Start

```bash
pnpm install    # Install dependencies
pnpm build      # Compile TypeScript
pnpm test       # Run tests
pnpm test:watch # Run tests in watch mode
pnpm lint       # Run linter
pnpm lint:fix   # Run linter with auto-fix
```

## Project Structure

```
src/
  index.ts          # Public exports
  types.ts          # Instruction types (Functional Core)
  instructions.ts   # Factory functions (Functional Core)
  stage.ts          # Stage factory (Functional Core)
  render.ts         # Dockerfile rendering (Functional Core)
tests/
  fixtures/         # Expected Dockerfiles + generators
  generation.test.ts
docs/
  design-plans/     # Design documents
  implementation-plans/  # Implementation task plans
adrs/               # Architecture Decision Records
```

## Architecture

### FCIS Pattern

This project follows Functional Core, Imperative Shell:
- **Functional Core:** All src/ files are pure - types, factory functions, rendering. Currently all production code is Functional Core.
- **Imperative Shell:** Tests perform I/O (file reading, dynamic imports)

Mark all files with pattern comment: `// pattern: Functional Core` or `// pattern: Imperative Shell`

### Type System

- Use `type` over `interface` (except for class contracts)
- Use `ReadonlyArray<T>` for array parameters
- Use `null` for absent values (not `undefined`)
- Use `Array<T>` syntax (not `T[]`)
- All fields are `readonly`
- Strict TypeScript configuration

### File Structure Details

```
src/
  index.ts        # Public API exports
  types.ts        # All instruction types, Stage, option types
  instructions.ts # Factory functions for creating instructions
  stage.ts        # Factory function for creating multi-stage stages
  render.ts       # Rendering functions for Dockerfile output
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

### Stage Type

For multi-stage builds:

```typescript
type Stage = {
  readonly name: string;
  readonly instructions: ReadonlyArray<Instruction>;
};
```

### Containerfile Type

Unified discriminated union supporting both single-stage and multi-stage:

```typescript
type Containerfile =
  | { readonly instructions: ReadonlyArray<Instruction> }  // Single-stage
  | { readonly stages: ReadonlyArray<Stage> };              // Multi-stage
```

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
| `stage` | `(name: string, instructions: ReadonlyArray<Instruction>)` | Creates a named stage for multi-stage builds |

### Render Functions

| Function | Signature | Notes |
|----------|-----------|-------|
| `render` | `(containerfile: Containerfile): string` | Renders full Containerfile to Dockerfile string |

Rendering behavior:
- Single-stage: Instructions joined with newlines (no trailing newline)
- Multi-stage: Stages joined with double newlines (blank line separator)
- RUN with array uses exec form `["cmd", "arg"]`
- EXPOSE omits `/tcp` suffix (default protocol)
- LABEL values are quoted
- Options rendered in order: `--platform`, `--from`, `--chown`, `--chmod`

### Validation

The `expose()` function validates:
- Port numbers are integers
- Port numbers are in range 0-65535
- Port range start <= end

Throws `Error` with descriptive message on invalid input.

## Testing

Fixture-based testing:
1. Create `tests/fixtures/<name>/expected.Dockerfile`
2. Create `tests/fixtures/<name>/generator.ts` exporting `fixture`
3. Run `pnpm test` - generator output compared to expected

Tests use Vitest with a fixture-based approach:

- Each fixture has a `generator.ts` exporting a `fixture` containerfile definition
- Each fixture has an `expected.Dockerfile` with the expected rendered output
- Tests dynamically discover fixtures and verify generation matches expected output

To add a new test fixture:
1. Create `tests/fixtures/<fixture-name>/generator.ts`
2. Create `tests/fixtures/<fixture-name>/expected.Dockerfile`
3. Export `fixture` from the generator file

## Git Workflow

### Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commit messages must follow this format:

```
<type>[optional scope]: <description>

[optional body]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance tasks, dependencies, tooling
- `docs:` - Documentation only changes
- `test:` - Adding or updating tests
- `refactor:` - Code change that neither fixes a bug nor adds a feature

### Trunk-Based Development

1. Create feature branch from main
2. Make commits per logical change (using conventional commits)
3. Pre-commit hook runs `pnpm lint:fix`
4. Pre-push hook runs `pnpm typecheck && pnpm test`
5. Squash merge back to main with descriptive message

### Merge Guidelines

- **Always squash merge** feature branches to main (keeps history clean)
- **Commit messages should describe what was built**, not implementation details
- **Do not reference phase numbers** or implementation plan details in final commit messages
- Focus on the "what" and "why" for users, not the "how" of development

### Git Hooks

Husky manages git hooks:

- **pre-commit**: Runs `pnpm lint:fix` to auto-fix lint issues
- **pre-push**: Runs `pnpm typecheck && pnpm test` to verify before push

## ADRs

Architecture Decision Records go in `adrs/` with sequential filenames:
- `00-use-discriminated-unions.md`
- `01-fixture-based-testing.md`

## Implementation Status

- Phase 1: Project Scaffolding - Complete
- Phase 2: Core Instruction Types - Complete
- Phase 3: Factory Functions - Complete
- Phase 4: Rendering Logic - Complete
- Phase 5: Multi-Stage Support - Complete
- Phase 6: Testing Infrastructure - Complete
- Phase 7: Linting and Git Hooks - Complete
- Phase 8: Documentation - Complete
