# containerfile-ts Initial Design

## Overview

A TypeScript library for generating Containerfiles/Dockerfiles programmatically using type-safe declarative object literals, inspired by [gha-ts](https://github.com/JLarky/gha-ts) for GitHub Actions.

**Goals:**
- Type-safe Dockerfile generation with compile-time validation
- First-class multi-stage build support with composable stages
- Declarative API using factory functions (gha-ts pattern)
- Public npm package with stable API

**Success criteria:**
- All core Dockerfile instructions supported (FROM, RUN, COPY, ADD, WORKDIR, ENV, EXPOSE, CMD, ENTRYPOINT, ARG, LABEL)
- Multi-stage builds work with type-safe cross-stage references
- Fixture-based tests compare generated output to expected Dockerfiles
- Published to npm with complete documentation

## Architecture

### API Pattern: Declarative Object Literals

Following gha-ts, the library uses typed object literals with factory functions:

```typescript
import { containerfile, from, workdir, copy, run, expose, cmd } from 'containerfile-ts';

const dockerfile = containerfile({
  instructions: [
    from('node:20-alpine'),
    workdir('/app'),
    copy('package*.json', '.'),
    run('npm ci'),
    copy('.', '.'),
    expose(3000),
    cmd(['node', 'dist/index.js']),
  ],
});

console.log(render(dockerfile));
```

### Type System

Discriminated union with `type` field enables exhaustive pattern matching:

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

type FromInstruction = {
  readonly type: 'FROM';
  readonly image: string;
  readonly as?: string;
  readonly platform?: string;
};
```

### Multi-Stage Support

Stages group instructions under named stages with type-safe cross-references:

```typescript
const dockerfile = multiStageContainerfile({
  stages: [
    stage('builder', [
      from('node:20', { as: 'builder' }),
      workdir('/app'),
      copy('.', '.'),
      run('npm ci && npm run build'),
    ]),
    stage('runtime', [
      from('node:20-alpine', { as: 'runtime' }),
      copy('/app/dist', '.', { from: 'builder' }),
      cmd(['node', 'index.js']),
    ]),
  ],
});
```

### FCIS Separation

- **Functional Core:** Types, factory functions, validation logic (pure, no I/O)
- **Imperative Shell:** Rendering to string, file output (side effects)

## Existing Patterns

This is a greenfield project with no existing codebase. Patterns are established fresh:

- **gha-ts pattern:** Declarative object literals with factory functions
- **TypeScript house style:** `type` over `interface`, `ReadonlyArray<T>`, `null` for absent values
- **FCIS:** Pure core logic separated from I/O shell

## Implementation Phases

### Phase 1: Project Scaffolding

**Goal:** Initialize project with mise, pnpm, TypeScript, and basic tooling.

**Components:**
- Create: `.mise.toml` (Node.js LTS, pnpm)
- Create: `package.json` (project metadata, scripts)
- Create: `tsconfig.json` (strict TypeScript config)
- Create: `src/index.ts` (empty entry point)

**Dependencies:** None (first phase)

**Testing:**
- `mise install` succeeds
- `pnpm install` succeeds
- `pnpm build` produces output

### Phase 2: Core Instruction Types

**Goal:** Define TypeScript types for all supported Dockerfile instructions.

**Components:**
- Create: `src/types.ts` (all instruction types, discriminated union)

**Dependencies:** Phase 1

**Testing:**
- TypeScript compiles without errors
- Type exports are accessible from `src/index.ts`

### Phase 3: Factory Functions

**Goal:** Implement factory functions for creating instruction objects.

**Components:**
- Create: `src/instructions.ts` (factory functions: from, run, copy, etc.)
- Update: `src/index.ts` (export factory functions)

**Dependencies:** Phase 2

**Testing:**
- Factory functions return correctly typed objects
- TypeScript prevents invalid instruction construction

### Phase 4: Rendering Logic

**Goal:** Implement Dockerfile string rendering from instruction objects.

**Components:**
- Create: `src/render.ts` (render function, instruction formatters)
- Update: `src/index.ts` (export render function)

**Dependencies:** Phase 3

**Testing:**
- Single instructions render correctly
- Full containerfile renders complete Dockerfile

### Phase 5: Multi-Stage Support

**Goal:** Add stage grouping and multi-stage containerfile support.

**Components:**
- Update: `src/types.ts` (Stage type, MultiStageContainerfile type)
- Create: `src/stage.ts` (stage factory, validation)
- Update: `src/render.ts` (multi-stage rendering)
- Update: `src/index.ts` (export stage utilities)

**Dependencies:** Phase 4

**Testing:**
- Stages render with correct AS clauses
- Cross-stage COPY --from works correctly

### Phase 6: Testing Infrastructure

**Goal:** Set up vitest with fixture-based testing pattern.

**Components:**
- Create: `vitest.config.ts`
- Create: `tests/fixtures/simple-node/expected.Dockerfile`
- Create: `tests/fixtures/simple-node/generator.ts`
- Create: `tests/fixtures/multi-stage-node/expected.Dockerfile`
- Create: `tests/fixtures/multi-stage-node/generator.ts`
- Create: `tests/generation.test.ts` (fixture discovery and comparison)

**Dependencies:** Phase 5

**Testing:**
- `pnpm test` runs all fixture tests
- Tests pass for simple and multi-stage cases

### Phase 7: Linting and Git Hooks

**Goal:** Configure oxlint and Husky for code quality enforcement.

**Components:**
- Create: `oxlint.json` (linter configuration)
- Create: `.husky/pre-commit` (run oxlint --fix)
- Create: `.husky/pre-push` (run tests)
- Update: `package.json` (add lint scripts, husky prepare)

**Dependencies:** Phase 6

**Testing:**
- `pnpm lint` runs without errors
- Commits trigger lint fixes
- Pushes blocked if tests fail

### Phase 8: Documentation and CLAUDE.md

**Goal:** Create project documentation and AI assistant instructions.

**Components:**
- Create: `CLAUDE.md` (house style, ADR workflow, testing, trunk-based development)
- Create: `adrs/` directory
- Create: `plans/` directory
- Create: `README.md` (usage, API reference, examples)

**Dependencies:** Phase 7

**Testing:**
- Documentation accurately describes API
- CLAUDE.md contains all required sections

## Additional Considerations

**Validation:** Factory functions validate inputs at construction time (e.g., port numbers 0-65535). Invalid inputs throw descriptive errors.

**Extensibility:** The discriminated union pattern allows adding new instruction types without breaking existing code. Future phases could add HEALTHCHECK, SHELL, USER, VOLUME, etc.

**Publishing:** After Phase 8, a follow-up implementation plan will cover npm publishing, CI/CD setup, and versioning strategy.
