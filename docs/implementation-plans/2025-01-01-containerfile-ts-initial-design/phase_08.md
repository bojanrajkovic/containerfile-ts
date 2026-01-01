# containerfile-ts Implementation Plan - Phase 8: Documentation and CLAUDE.md

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Create project documentation and AI assistant instructions.

**Architecture:** CLAUDE.md provides project conventions for AI assistants. README.md provides user-facing documentation with API reference and examples.

**Tech Stack:** Markdown

**Scope:** Phase 8 of 8 from original design

**Codebase verified:** 2025-01-01 - All library code, tests, and tooling exist after Phases 1-7

---

## Task 8.1: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: Create CLAUDE.md with project conventions**

```markdown
# containerfile-ts

Type-safe Dockerfile/Containerfile generation with declarative TypeScript.

## Quick Start

```bash
pnpm install    # Install dependencies
pnpm build      # Compile TypeScript
pnpm test       # Run tests
pnpm lint       # Run linter
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
```

## Architecture

### FCIS Pattern

This project follows Functional Core, Imperative Shell:
- **Functional Core:** All src/ files are pure - types, factory functions, rendering
- **Imperative Shell:** Tests perform I/O (file reading, dynamic imports)

Mark all files with pattern comment: `// pattern: Functional Core` or `// pattern: Imperative Shell`

### Type System

- Use `type` over `interface` (except for class contracts)
- Use `ReadonlyArray<T>` for array parameters
- Use `null` for absent values (not `undefined`)
- Use `Array<T>` syntax (not `T[]`)

## Testing

Fixture-based testing:
1. Create `tests/fixtures/<name>/expected.Dockerfile`
2. Create `tests/fixtures/<name>/generator.ts` exporting `fixture`
3. Run `pnpm test` - generator output compared to expected

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

## ADRs

Architecture Decision Records go in `adrs/` with sequential filenames:
- `00-use-discriminated-unions.md`
- `01-fixture-based-testing.md`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project conventions"
```

---

## Task 8.2: Create ADRs directory

**Files:**
- Create: `adrs/.gitkeep`

**Step 1: Create adrs directory with .gitkeep**

```bash
mkdir -p adrs
touch adrs/.gitkeep
```

**Step 2: Commit**

```bash
git add adrs/
git commit -m "chore: add adrs directory"
```

---

## Task 8.3: Create README.md

**Files:**
- Create: `README.md`

**Step 1: Create README.md with usage documentation**

```markdown
# containerfile-ts

Type-safe Dockerfile/Containerfile generation with declarative TypeScript, inspired by [gha-ts](https://github.com/JLarky/gha-ts).

## Installation

```bash
npm install containerfile-ts
# or
pnpm add containerfile-ts
```

## Usage

### Simple Dockerfile

```typescript
import { containerfile, from, workdir, copy, run, expose, cmd, render } from 'containerfile-ts';

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

Output:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Multi-Stage Build

```typescript
import { containerfile, stage, from, workdir, copy, run, cmd, render } from 'containerfile-ts';

const dockerfile = containerfile({
  stages: [
    stage('builder', [
      from('node:20', { as: 'builder' }),
      workdir('/app'),
      copy('package*.json', '.'),
      run('npm ci'),
      copy('.', '.'),
      run('npm run build'),
    ]),
    stage('runtime', [
      from('node:20-alpine', { as: 'runtime' }),
      workdir('/app'),
      copy('/app/dist', './dist', { from: 'builder' }),
      cmd(['node', 'dist/index.js']),
    ]),
  ],
});

console.log(render(dockerfile));
```

## API Reference

### Factory Functions

| Function | Description |
|----------|-------------|
| `from(image, options?)` | FROM instruction |
| `run(command)` | RUN instruction (string or exec form) |
| `copy(src, dest, options?)` | COPY instruction |
| `add(src, dest, options?)` | ADD instruction |
| `workdir(path)` | WORKDIR instruction |
| `env(key, value)` | ENV instruction |
| `expose(port, options?)` | EXPOSE instruction |
| `cmd(command)` | CMD instruction (exec form) |
| `entrypoint(command)` | ENTRYPOINT instruction (exec form) |
| `arg(name, options?)` | ARG instruction |
| `label(key, value)` | LABEL instruction |
| `stage(name, instructions)` | Named stage for multi-stage builds |
| `containerfile(def)` | Create containerfile definition |

### Rendering

| Function | Description |
|----------|-------------|
| `render(containerfile)` | Render to Dockerfile string |
| `renderInstruction(instruction)` | Render single instruction |

## Options

### FromOptions

- `as?: string` - Stage name (AS clause)
- `platform?: string` - Target platform

### CopyOptions

- `from?: string` - Source stage name
- `chown?: string` - Change ownership
- `chmod?: string` - Change permissions

### ExposeOptions

- `protocol?: 'tcp' | 'udp'` - Port protocol (default: tcp)

### ArgOptions

- `defaultValue?: string` - Default value for build arg

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage documentation"
```

---

## Task 8.4: Verify documentation accuracy

**Step 1: Verify README examples compile**

Create a temporary test file and verify the examples work:

Run: `pnpm build && node -e "const c = require('./dist/index.js'); console.log(c.render(c.containerfile({instructions: [c.from('node:20')]})))"`
Expected: Outputs `FROM node:20`

**Step 2: Verify all documented functions are exported**

Run: `cat dist/index.d.ts`
Expected: All documented functions visible in exports
