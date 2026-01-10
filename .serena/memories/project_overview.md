# containerfile-ts Project Overview

## Purpose
Type-safe Dockerfile/Containerfile generation with declarative TypeScript. This is a library that allows developers to create Docker/Containerfiles programmatically using TypeScript, with full type safety and IDE support.

## Tech Stack
- **Language**: TypeScript 5.7+
- **Runtime**: Node.js >= 20 (ES2022 target)
- **Package Manager**: pnpm
- **Build Tool**: TypeScript compiler (tsc)
- **Testing**: Vitest
- **Linting**: oxlint
- **Git Hooks**: Husky

## Repository
- GitHub: https://github.com/brajkovic/containerfile-ts.git
- License: MIT
- Author: Bojan Rajkovic

## Project Type
This is a **library** (not an application). It exports TypeScript functions and types for creating Dockerfile definitions programmatically. The main entry point is `dist/index.js` (built from `src/index.ts`).

## Codebase Structure

```
src/
  index.ts          # Public API exports
  types.ts          # All instruction types, Stage, Containerfile, option types
  instructions.ts   # Factory functions for creating instructions
  stage.ts          # Factory function for creating stages
  render.ts         # Rendering functions for Dockerfile output

tests/
  generation.test.ts  # Fixture-based generation tests
  fixtures/           # Test fixtures (generator.ts + expected.Dockerfile)

docs/
  design-plans/       # Design documents
  implementation-plans/  # Implementation task plans
  future-instructions.md  # Historical context for future work

adrs/                 # Architecture Decision Records

dist/                 # Build output (TypeScript compilation)
```

## Key Files
- `package.json` - Project metadata and scripts
- `tsconfig.json` - TypeScript configuration (strict mode enabled)
- `vitest.config.ts` - Test configuration
- `oxlint.json` - Linting configuration
- `CLAUDE.md` - Project documentation for AI assistants
- `.husky/` - Git hooks (pre-commit, pre-push)

## Development Platform
The project is developed on macOS (Darwin), but should work on any platform with Node.js >= 20.
