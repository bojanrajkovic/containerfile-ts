# Changesets CI/CD Migration Design

## Overview

Migrate containerfile-ts from release-please to Changesets for release management, adopting patterns from the grounds project for consistency across repositories.

**Goals:**

- Consistency with grounds project release workflow
- Better changelog generation via Changesets
- Move alpha releases from GitHub Packages to npm with `@alpha` tag
- Add formatting checks and upgrade linting configuration

**Success criteria:**

- Single OIDC entry point (`publish-switch.yml`) routes to alpha and release workflows
- Conventional commits automatically generate changesets via custom script
- Alpha versions published to npm as `{version}-{branch}-{sha}`
- Production releases managed via "Version Packages" PR workflow
- CI validates formatting before linting

## Architecture

### Workflow Structure

Single OIDC entry point pattern (matches grounds):

```
publish-switch.yml (OIDC trusted publisher)
├── workflow_run on feat/*/fix/* CI success → publish-alpha.yml
└── push to main → publish-release.yml
```

Both workflows publish to npm (different tags):

- Alpha: `@alpha` tag with snapshot version
- Release: `@latest` tag with semantic version

### Changeset Generation

Custom `scripts/generate-changeset.ts` (adapted from grounds) converts conventional commits to changesets:

| Commit Type                       | Version Bump |
| --------------------------------- | ------------ |
| `feat:`                           | minor        |
| `fix:`, `refactor:`, `perf:`      | patch        |
| `BREAKING CHANGE:`                | major        |
| `chore:`, `docs:`, `test:`, `ci:` | ignored      |

Script runs on push to main, analyzes commits since last tag, generates `.changeset/*.md` files.

### Alpha Publishing Flow

Trigger: CI passes on `feat/*` or `fix/*` branches

```
1. Extract branch name, sanitize (remove feat//fix/ prefix)
2. Get short SHA (7 chars)
3. changeset version --snapshot {branch}-{sha}
4. changeset publish --tag alpha
```

Version format: `1.0.0-add-healthcheck-abc1234`

### Release Publishing Flow

Trigger: Push to main branch

```
1. If not release commit: generate changesets from conventional commits
2. Check for releasable changesets (minor/patch declarations)
3. changesets/action creates "Version Packages" PR
4. PR contains: bumped package.json, updated CHANGELOG.md
5. On PR merge: detect release commit, publish to npm @latest
```

## Existing Patterns

Investigation of grounds project revealed:

- `publish-switch.yml` as single OIDC entry point calling reusable workflows
- `generate-changeset.ts` using `conventional-commits-parser` for commit analysis
- Snapshot versioning with `{branch}-{sha}` pattern
- `changesets/action@v1.5.3` for version PR management

Investigation of containerfile-ts revealed:

- Security audits in CI (`pnpm audit`, signature verification) - **keep**
- Dependency review workflow - **keep**
- Pre-push hook with typecheck + tests - **keep**
- mise for Node/pnpm version management - **keep, pin versions**

This design follows grounds patterns for release workflow while preserving containerfile-ts security practices.

## Implementation Phases

### Phase 1: Changesets Foundation

**Goal:** Set up Changesets configuration and dependencies

**Components:**

- `.changeset/config.json` — Changesets configuration for single-package repo
- `package.json` — Add `@changesets/cli`, `conventional-commits-parser` dependencies
- `package.json` — Add changeset-related scripts

**Dependencies:** None (first phase)

**Done when:** `pnpm changeset` command works, configuration is valid

### Phase 2: Changeset Generation Script

**Goal:** Automate changeset creation from conventional commits

**Components:**

- `scripts/generate-changeset.ts` — Parses commits, generates changeset files
  - Uses `conventional-commits-parser` for commit message parsing
  - Maps commit types to version bumps
  - Generates `.changeset/*.md` files with proper frontmatter
  - Simplified from grounds (single package, no linked versioning)

**Dependencies:** Phase 1 (Changesets must be configured)

**Done when:** Running script generates valid changeset files from test commits

### Phase 3: Workflow Architecture

**Goal:** Implement publish-switch routing and reusable workflows

**Components:**

- `.github/workflows/publish-switch.yml` — OIDC entry point with routing logic
  - Routes `workflow_run` events to alpha workflow
  - Routes `push` to main to release workflow
  - Passes appropriate permissions to each
- `.github/workflows/publish-alpha.yml` — Reusable workflow for snapshot releases
  - Snapshot versioning with `{branch}-{sha}` pattern
  - Publishes to npm with `@alpha` tag
- `.github/workflows/publish-release.yml` — Reusable workflow for production releases
  - Calls generate-changeset.ts for non-release commits
  - Uses `changesets/action@v1.5.3` for version PR management
  - Publishes to npm with `@latest` tag on release commit

**Dependencies:** Phase 2 (script must exist for release workflow)

**Done when:** Workflows pass validation, routing logic is correct

### Phase 4: CI Enhancements

**Goal:** Add formatting and upgrade linting

**Components:**

- `package.json` — Add `oxfmt` dev dependency, `format` and `format:check` scripts
- `.github/workflows/ci.yml` — Add `format:check` step before lint
- `.oxlintrc.json` — Add explicit rules (`no-unused-vars`, `no-console`, `eqeqeq`)
- `package.json` — Upgrade `oxlint` to v0.16.6+
- `.mise.toml` — Pin versions (`node = "22"`, `pnpm = "10.27.0"`)

**Dependencies:** None (can run in parallel with Phase 3)

**Done when:** CI runs format check, lint passes with new rules, mise uses pinned versions

### Phase 5: Migration and Cleanup

**Goal:** Remove old release infrastructure, configure npm OIDC

**Components:**

- Remove `.github/workflows/release-please.yml`
- Remove GitHub Packages config from `.npmrc`
- Update npm trusted publisher: `release-please.yml` → `publish-switch.yml`
- Update `CLAUDE.md` with new workflow documentation

**Dependencies:** Phases 3 and 4 (new workflows must be in place)

**Done when:** Old workflows removed, npm OIDC updated, alpha and release workflows succeed

## Additional Considerations

**npm OIDC configuration:** User must manually update trusted publisher on npmjs.com before Phase 5 can complete. This is an external dependency outside the codebase.

**No transition period:** Clean break from GitHub Packages to npm for alpha releases. Existing alpha consumers will need to update their registry configuration.

**Verification approach:** Workflow changes are verified by successful CI runs and test publishes. No unit tests needed for workflow YAML files.
