# CI/CD Infrastructure and Release Automation Design

## Overview

Automated testing, publishing, and release infrastructure for containerfile-ts using GitHub Actions, semantic-release, and OIDC trusted publishing.

**Goals:**

- Run automated tests on all branches and pull requests
- Publish alpha packages from feature branches to GitHub Package Registry
- Automate releases to npm based on conventional commits
- Enforce conventional commit format at local and CI levels
- Eliminate long-lived secrets with OIDC trusted publishing

## Architecture

Three GitHub Actions workflows handle the CI/CD pipeline:

**1. CI Testing** (`ci.yml`)
Runs on all branches and pull requests. Validates code quality through linting, type-checking, testing, building, and security audits. Publishing workflows wait for CI to pass before executing.

**2. Alpha Publishing** (`publish-alpha.yml`)
Triggers on pushes to `feat/*` and `fix/*` branches after CI passes. Uses semantic-release to publish per-branch pre-release versions to GitHub Package Registry. Branch `feat/user-instruction` creates versions `1.0.0-user-instruction.1`, `1.0.0-user-instruction.2`, etc.

**3. Release Publishing** (`release.yml`)
Triggers on pushes to `main` branch after CI passes. semantic-release analyzes conventional commits and creates releases (`feat:` → minor, `fix:` → patch). Publishes to npm, generates CHANGELOG.md, creates git tags and GitHub releases.

**Conventional commit enforcement:**

- Local: commitlint hook blocks invalid commit messages
- Local: lint-staged runs oxlint on staged files only
- CI: PR title validation (critical for squash merge workflow)

**Security:**

- npm audit and signature verification on every CI run
- GitHub Dependency Review Action blocks vulnerable dependencies in PRs
- OIDC trusted publishing eliminates NPM_TOKEN secrets
- Automatic npm provenance attestations

**Publishing strategy:**

- Alpha: `@bojanrajkovic/containerfile-ts@1.0.0-feature-name.N` → GitHub Package Registry
- Release: `containerfile-ts@0.x.x` → npm public registry
- No beta channel (simplified from initial requirements)

**Versioning:**

- Currently at 0.0.1, stays in 0.x range until ready for 1.0.0
- `feat:` commits create minor bumps (0.1.0, 0.2.0)
- `fix:` commits create patch bumps (0.0.2, 0.0.3)
- Breaking changes or manual trigger creates 1.0.0

## Existing Patterns

Investigation found:

- Existing git hooks: `.husky/pre-commit` (lint), `.husky/pre-push` (typecheck + test)
- Trunk-based development with squash merges to main
- Conventional commit types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`
- No existing CI/CD workflows (clean slate)
- Package.json properly configured for npm publishing

This design extends the existing git hook pattern and follows the established conventional commit workflow. The squash merge strategy means only PR titles need to be valid conventional commits (individual PR commits are squashed away).

## Implementation Phases

### Phase 1: Dependencies and Core Configuration

**Goal:** Install required packages and create semantic-release configuration

**Components:**

- Update `package.json` devDependencies:
  - `@commitlint/cli@^20.1.0`
  - `@commitlint/config-conventional@^20.1.0`
  - `conventional-changelog-conventionalcommits@^8.0.0`
  - `lint-staged@^15.2.0`
  - `semantic-release@^23.0.0`
  - `@semantic-release/changelog@^7.0.0`
  - `@semantic-release/commit-analyzer@^13.0.0`
  - `@semantic-release/git@^10.0.0`
  - `@semantic-release/github@^10.0.0`
  - `@semantic-release/npm@^12.0.0`
  - `@semantic-release/release-notes-generator@^14.0.0`
- Create `.releaserc.json` with branch configuration and plugins
- Create `.commitlintrc.json` extending conventional config
- Create `.npmrc` routing scoped packages to GitHub Package Registry

**Dependencies:** None (first phase)

**Done when:** `pnpm install` succeeds, no dependency resolution errors

### Phase 2: Commitlint and lint-staged Setup

**Goal:** Configure local git hooks for commit validation and fast linting

**Components:**

- Create `.husky/commit-msg` hook running commitlint
- Update `.husky/pre-commit` to use lint-staged instead of `pnpm lint:fix`
- Add lint-staged configuration to `package.json`:
  ```json
  {
    "lint-staged": {
      "*.ts": ["oxlint --fix"]
    }
  }
  ```

**Dependencies:** Phase 1 (packages installed)

**Done when:**

- Commit with invalid message is rejected locally
- Commit with valid message succeeds
- Pre-commit hook only lints staged files (verify by staging one file and committing)
- Pre-push hook still runs `pnpm typecheck && pnpm test`

### Phase 3: CI Testing Workflow

**Goal:** Automated quality checks on all branches and PRs

**Components:**

- Create `.github/workflows/ci.yml`:
  - Triggers: `push` to all branches, `pull_request` events
  - Node version: 24.x
  - Steps: checkout, setup Node with pnpm cache, install, lint, typecheck, test, build, audit, audit signatures
  - Job name: `quality` (referenced by other workflows)

**Dependencies:** Phase 1 (package.json scripts exist)

**Done when:**

- Push to any branch triggers workflow
- Pull request triggers workflow
- All steps pass on main branch
- Workflow fails if any step fails (verify by introducing lint error)

### Phase 4: Alpha Publishing Workflow

**Goal:** Publish per-branch pre-releases to GitHub Package Registry

**Components:**

- Create `.github/workflows/publish-alpha.yml`:
  - Triggers: `workflow_run` for CI on `feat/*` and `fix/*` branches
  - Permissions: `contents: write`, `packages: write`, `id-token: write`
  - Condition: Only run if CI workflow succeeded
  - Steps: checkout with full history, setup Node, install, run semantic-release
  - Environment: `NPM_CONFIG_REGISTRY` set to GitHub Package Registry for scoped packages

**Dependencies:**

- Phase 1 (.releaserc.json configured)
- Phase 3 (CI workflow exists)

**Done when:**

- Push to `feat/test-feature` branch publishes `@bojanrajkovic/containerfile-ts@1.0.0-test-feature.1`
- Package appears in GitHub Package Registry
- Workflow skipped for `chore/*` or other non-feat/fix branches
- Second push to same branch increments version (`.2`)

### Phase 5: Release Publishing Workflow

**Goal:** Automated releases to npm from main branch

**Components:**

- Create `.github/workflows/release.yml`:
  - Triggers: `workflow_run` for CI on `main` branch
  - Permissions: `contents: write`, `issues: write`, `pull-requests: write`, `id-token: write`
  - Condition: Only run if CI workflow succeeded
  - Steps: checkout with full history, setup Node, install, run semantic-release
  - Uses OIDC for npm authentication (no NPM_TOKEN secret)

**Dependencies:**

- Phase 1 (.releaserc.json configured)
- Phase 3 (CI workflow exists)

**Done when:**

- Merge PR with `feat:` commit to main creates 0.1.0 release
- Release published to npm (verify on npmjs.com)
- Git tag created (v0.1.0)
- GitHub release created with changelog
- CHANGELOG.md committed to repository
- `chore(release): 0.1.0 [skip ci]` commit doesn't trigger new CI run

### Phase 6: PR Title Validation Workflow

**Goal:** Enforce conventional commits on PR titles for squash merges

**Components:**

- Create `.github/workflows/pr-title.yml`:
  - Triggers: `pull_request` events (opened, edited, synchronize, reopened)
  - Uses: `amannn/action-semantic-pull-request@v5`
  - Validates PR title follows conventional commit format
  - Job name: `semantic-pr-title` (referenced by branch protection)

**Dependencies:** None (standalone validation)

**Done when:**

- PR with valid title (`feat: add healthcheck`) passes check
- PR with invalid title (`Add healthcheck`) fails check
- Editing PR title re-runs validation
- Check appears in PR status checks

### Phase 7: npm OIDC Setup and Branch Protection

**Goal:** Configure trusted publishing and enforce CI checks

**Components:**

- Document npm OIDC setup steps in CLAUDE.md:
  1. Configure trusted publisher on npmjs.com
  2. Link GitHub Actions workflow (release.yml)
  3. No NPM_TOKEN secret needed
- Configure GitHub branch protection on `main`:
  - Require status checks: `quality` (CI), `semantic-pr-title`
  - Require branches up to date before merging
  - Require linear history (enforces squash merges)

**Dependencies:**

- Phase 3 (CI workflow for quality check)
- Phase 6 (PR title workflow for semantic-pr-title check)

**Done when:**

- npm package settings show GitHub Actions as trusted publisher
- Cannot merge PR without CI passing
- Cannot merge PR with invalid title
- Manual push to main blocked (must use PRs)

### Phase 8: Documentation and Verification

**Goal:** Update documentation and verify complete pipeline

**Components:**

- Update `CLAUDE.md` with:
  - CI/CD workflow descriptions
  - Publishing strategy (alpha vs release)
  - OIDC setup instructions
  - Branch protection requirements
- Update `README.md` with:
  - Installation instructions for alpha packages
  - Link to CHANGELOG.md
  - npm and GitHub Package Registry badges (optional)
- Create test PR with `feat:` commit to verify:
  - CI runs and passes
  - PR title validation passes
  - Alpha package published
  - After merge, release created and published

**Dependencies:** Phases 1-7 (complete pipeline)

**Done when:**

- Documentation updated and committed
- Test PR merged successfully
- Alpha package published during PR
- Release package published after merge
- All workflows green in GitHub Actions

## Additional Considerations

**Workflow execution order:**
All publishing workflows use `workflow_run` to wait for CI completion. This prevents wasted workflow minutes publishing packages that fail tests.

**Concurrency control:**
Each workflow includes concurrency groups (`${{ github.workflow }}-${{ github.ref }}`) with `cancel-in-progress: true`. New pushes to the same branch cancel in-progress runs, saving resources.

**CHANGELOG format:**
semantic-release groups changes by type (Features, Bug Fixes, Documentation, Code Refactoring). Hides non-user-facing changes (tests, chores, CI). Links to commits and PRs automatically. Commits CHANGELOG.md back to repository with `[skip ci]` to prevent infinite loops.

**Future enhancements:**

- Renovate integration for automated dependency updates
- Code coverage reporting (Codecov or Coveralls)
- Performance benchmarking suite
- Multi-registry publishing (npm + GitHub Packages + JSR)

These enhancements can be added incrementally without changing the core architecture.
