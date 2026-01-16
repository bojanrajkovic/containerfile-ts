# containerfile-ts

> Freshness: 2026-01-15

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
.github/workflows/  # CI/CD automation (see CI/CD Workflows section)
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
  | { readonly instructions: ReadonlyArray<Instruction> } // Single-stage
  | { readonly stages: ReadonlyArray<Stage> }; // Multi-stage
```

### Factory Functions

Factory functions create instruction objects with optional parameters via option objects:

| Function        | Signature                                                                     | Notes                                           |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `from`          | `(image: string, options?: FromOptions)`                                      | `as`, `platform` options                        |
| `run`           | `(command: string \| ReadonlyArray<string>)`                                  | Shell or exec form                              |
| `copy`          | `(src: string \| ReadonlyArray<string>, dest: string, options?: CopyOptions)` | `from`, `chown`, `chmod` options                |
| `add`           | `(src: string \| ReadonlyArray<string>, dest: string, options?: AddOptions)`  | `chown`, `chmod` options                        |
| `workdir`       | `(path: string)`                                                              |                                                 |
| `env`           | `(key: string, value: string)`                                                |                                                 |
| `expose`        | `(port: number \| {start, end}, options?: ExposeOptions)`                     | Validates port range 0-65535, `protocol` option |
| `cmd`           | `(command: ReadonlyArray<string>)`                                            | Exec form only                                  |
| `entrypoint`    | `(command: ReadonlyArray<string>)`                                            | Exec form only                                  |
| `arg`           | `(name: string, options?: ArgOptions)`                                        | `defaultValue` option                           |
| `label`         | `(key: string, value: string)`                                                |                                                 |
| `containerfile` | `(def: Containerfile)`                                                        | Identity function for type safety               |
| `stage`         | `(name: string, instructions: ReadonlyArray<Instruction>)`                    | Creates a named stage for multi-stage builds    |

### Render Functions

| Function | Signature                                | Notes                                           |
| -------- | ---------------------------------------- | ----------------------------------------------- |
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

- **commit-msg**: Validates conventional commit format via commitlint
- **pre-commit**: Runs lint-staged (`pnpm lint:fix` on staged files)
- **pre-push**: Runs `pnpm typecheck && pnpm test` to verify before push

## CI/CD Workflows

This project uses GitHub Actions for automated testing, publishing, and releases.

### Workflows

**CI Testing (`ci.yml`)**

- **Triggers:** All branches and pull requests
- **Purpose:** Quality validation before merge or publish
- **Steps:** Format check → Lint → Typecheck → Test → Build → Security audit
- **Required:** Must pass before PRs can merge (branch protection)

**Publish Switch (`publish-switch.yml`)**

- **Triggers:** CI passes on `feat/*` or `fix/*` branches, or push to main
- **Purpose:** Single OIDC entry point routing to alpha or release workflows
- **Routes to:**
  - `publish-alpha.yml` for feat/fix branches
  - `publish-release.yml` for main branch

**Alpha Publishing (`publish-alpha.yml`)**

- **Triggers:** Called by publish-switch after CI passes on `feat/*` or `fix/*` branches
- **Purpose:** Per-branch pre-release packages for testing
- **Publishes to:** npm with `@alpha` tag
- **Versioning:** Changesets snapshot: `{version}-{branch}-{sha}`
- **Example:** `@bojanrajkovic/containerfile-ts@1.0.0-add-healthcheck-abc1234`
- **Usage:** `pnpm add @bojanrajkovic/containerfile-ts@alpha`

**Release Publishing (`publish-release.yml`)**

- **Triggers:** Called by publish-switch on push to main
- **Purpose:** PR-based production releases to npm
- **Uses:** Changesets with custom `generate-changeset.ts` script
- **Versioning:** `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major
- **Workflow:**
  1. Generates changesets from conventional commits since last tag
  2. Creates "Version Packages" PR (if releasable changes exist)
  3. On PR merge: publishes to npm with `@latest` tag
- **Publishes to:** npm public registry as `@bojanrajkovic/containerfile-ts`

**PR Title Validation (`pr-title.yml`)**

- **Triggers:** PR opened, edited, synchronized, reopened
- **Purpose:** Enforce conventional commits on PR titles
- **Required:** Must pass before PRs can merge (branch protection)
- **Why:** Squash merge uses PR title as commit message on main

**Dependency Review (`dependency-review.yml`)**

- **Triggers:** Pull requests to main
- **Purpose:** Block vulnerable dependencies (moderate+ severity)
- **Action:** Comments on PR with security analysis

### Publishing Strategy

**Alpha packages (testing):**

- Push commits to `feat/user-auth` or `fix/validation-bug` branch
- CI runs and passes
- Alpha package published with snapshot version:
  - `@bojanrajkovic/containerfile-ts@1.0.0-user-auth-abc1234`
- Install with: `pnpm add @bojanrajkovic/containerfile-ts@alpha`

**Release packages (production):**

- Merge PR with `feat:` or `fix:` title to main
- `generate-changeset.ts` creates changesets from conventional commits
- changesets/action creates "Version Packages" PR with:
  - Version bump in package.json
  - Updated CHANGELOG.md with commit history
- Review and merge the "Version Packages" PR
- Merging triggers:
  - npm package publication: `@bojanrajkovic/containerfile-ts@x.x.x`
  - Git tag and GitHub Release creation
- Install with: `pnpm add @bojanrajkovic/containerfile-ts`

### Conventional Commits

All commits and PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:** `<type>[optional scope]: <description>`

**Types:**

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation only changes
- `chore:` - Maintenance tasks, dependencies, tooling
- `test:` - Adding or updating tests
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `perf:` - Performance improvements
- `ci:` - CI/CD configuration changes
- `revert:` - Reverts a previous commit

**Enforcement:**

- Local: `commit-msg` git hook validates commit messages
- CI: PR title validation workflow validates PR titles
- Required: PR titles must be valid (becomes commit message on squash merge)

**Examples:**

- `feat: add HEALTHCHECK instruction support`
- `fix: correct EXPOSE port range validation`
- `docs: update API documentation for multi-stage builds`
- `chore: upgrade vitest to 3.0.0`
- `feat(render): add comment support in Dockerfile output`

## npm OIDC Trusted Publishing

This project uses OIDC (OpenID Connect) trusted publishing to eliminate long-lived npm tokens. GitHub Actions authenticates directly with npm using short-lived tokens.

### Setup Instructions

**Initial setup (one-time, requires npm account owner):**

1. **Configure trusted publisher on npmjs.com:**
   - Go to https://www.npmjs.com/package/@bojanrajkovic/containerfile-ts/access
   - Click "Publishing access" → "Automation tokens" → "Configure trusted publishers"
   - Add GitHub Actions as trusted publisher:
     - Repository: `bojanrajkovic/containerfile-ts`
     - Workflow: `publish-switch.yml`
     - Environment: (leave blank)
   - Save configuration

2. **Verify OIDC is configured:**
   - Check package settings show "GitHub Actions" as trusted publisher
   - No NPM_TOKEN secret is needed in GitHub repository secrets

3. **How it works:**
   - GitHub Actions workflow requests OIDC token from GitHub
   - npm validates token against trusted publisher configuration
   - If valid, npm grants temporary publish permissions
   - Token expires after workflow completes (short-lived, secure)

### Benefits

- **No long-lived secrets:** npm tokens can't be stolen or leaked
- **Automatic provenance:** npm automatically generates provenance attestations
- **Audit trail:** All publishes linked to specific GitHub Actions runs
- **Zero maintenance:** No token rotation or expiration management needed

### Troubleshooting

If publishing fails with authentication error:

1. Verify trusted publisher is configured on npmjs.com
2. Verify repository name matches exactly: `bojanrajkovic/containerfile-ts`
3. Verify workflow name matches exactly: `publish-switch.yml`
4. Check workflow has `id-token: write` permission
5. Check `NPM_CONFIG_PROVENANCE: true` is set in workflow

## ADRs

Architecture Decision Records go in `adrs/` with sequential filenames:

- `00-use-discriminated-unions.md`
- `01-fixture-based-testing.md`

## Future Work

Track future tasks, enhancements, and bugs using [GitHub Issues](https://github.com/bojanrajkovic/containerfile-ts/issues).

**Before creating issues:** Show the user the proposed title, body, and labels for each issue and ask for feedback before creating it.

Historical context for potential future instructions is in `docs/future-instructions.md`.

## Implementation Status

- Phase 1: Project Scaffolding - Complete
- Phase 2: Core Instruction Types - Complete
- Phase 3: Factory Functions - Complete
- Phase 4: Rendering Logic - Complete
- Phase 5: Multi-Stage Support - Complete
- Phase 6: Testing Infrastructure - Complete
- Phase 7: Linting and Git Hooks - Complete
- Phase 8: Documentation - Complete
