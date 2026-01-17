# @bojanrajkovic/containerfile-ts

## 1.1.0

### Minor Changes

- migrate to changesets for release management (#22)

  - chore: add changesets and conventional-commits-parser dependencies

  Adds @changesets/cli for release management, conventional-commits-parser
  for parsing commit messages, and tsx for running TypeScript scripts.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: add changesets configuration

  Configures @changesets/cli for single-package release management.
  Uses public access and main as base branch.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: add changeset scripts to package.json

  Adds changeset, changeset-version, and release scripts for
  changesets-based release workflow.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - feat: add generate-changeset script for conventional commits

  Creates changesets automatically from conventional commit messages.
  Adapted from grounds project, simplified for single-package repo.

  Commit type mapping:

  - feat: minor bump
  - fix/refactor/perf: patch bump
  - BREAKING CHANGE: major bump
  - chore/docs/test/ci: ignored (no changeset)

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - fix: address code review feedback for generate-changeset.ts

  * Add FCIS pattern classification comment (Imperative Shell)
  * Add readonly modifiers to all CommitInfo type fields
  * Change CommitInfo[] to Array<CommitInfo> in return types for consistency
  * Change commits parameter type to ReadonlyArray<CommitInfo>
  * Refactor parseArgs to use immutable recursive pattern instead of let variables
  * Change args parameter from string[] to ReadonlyArray<string>
  * Fix error message capitalization to lowercase "failed to generate changeset"

  All changes align with project code style guidelines for immutability and type consistency.

  - ci: add publish-switch.yml as OIDC entry point

  Routes to alpha or release workflows based on trigger:

  - workflow_run on feat/fix branches → publish-alpha.yml
  - push to main → publish-release.yml

  Matches grounds project pattern for single OIDC trusted publisher.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - ci: update publish-alpha to use changesets and npm

  Changes:

  - Convert to reusable workflow (workflow_call)
  - Use changeset version --snapshot for versioning
  - Use changeset publish --tag alpha for publishing
  - Publish to npm (not GitHub Packages)
  - Version format: {version}-{branch}-{sha}

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - ci: add publish-release workflow with changesets

  Implements the production release flow:

  1. Generates changesets from conventional commits
  2. Checks for releasable changes (feat/fix, not chore/docs)
  3. Creates "Version Packages" PR via changesets/action
  4. Publishes to npm on PR merge

  Uses generate-changeset.ts to convert conventional commits.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: pin mise tool versions

  Pin node to 24 (LTS) and pnpm to 10.28.0 for reproducible builds.
  Avoids floating versions causing CI inconsistencies.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: upgrade oxlint and add explicit rules

  Upgrade oxlint from 0.15.0 to 1.39.0 (stable release with 655+ rules).
  Add explicit rules: no-unused-vars, eqeqeq (error), no-console (off).

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: add oxfmt formatter

  Adds oxfmt for consistent code formatting.
  New scripts: format (write), format:check (CI validation).
  Initial formatting of all project files.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - ci: add format check to CI workflow

  Adds format:check step before linting to catch formatting issues early.
  Fails fast on formatting problems before running other checks.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - ci: remove release-please.yml

  Replaced by changesets-based publish-release.yml workflow.
  The publish-switch.yml is now the OIDC entry point.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: remove GitHub Packages config from .npmrc

  Alpha packages now publish to npm with @alpha tag.
  No longer using GitHub Packages for pre-releases.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - docs: update CLAUDE.md for changesets workflow

  Updates CI/CD Workflows section to document:

  - publish-switch.yml as OIDC entry point
  - Changesets-based release flow
  - Alpha packages on npm (not GitHub Packages)
  - generate-changeset.ts for conventional commits

  Updates npm OIDC section with new workflow name.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: complete changesets migration

  Migration complete. Manual step required:
  Update npm trusted publisher workflow from release-please.yml to publish-switch.yml
  at https://www.npmjs.com/package/@bojanrajkovic/containerfile-ts/access

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - fix: update CLAUDE.md freshness date to 2026-01-15

  Update the freshness date in CLAUDE.md to reflect the current date,
  addressing code review feedback about documentation staleness.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - docs: update project context for changesets migration

  * Add formatting commands to Quick Start section
  * Add scripts/ and .changeset/ directories to project structure
  * Update npm publishing section to accurately reflect token-based auth
    with provenance (not pure OIDC as previously documented)
  * Correct troubleshooting steps for npm publishing

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - fix: correct serena project name to containerfile-ts

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: remove changesets migration implementation plans

  Implementation is complete, plans no longer needed.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - chore: remove all implementation plans and gitignore them

  Implementation plans are generated artifacts that don't need to be tracked.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

  - fix: detect breaking changes from feat!/fix! notation

  Configure conventional-commits-parser with breakingHeaderPattern to
  properly detect breaking changes from the exclamation mark notation
  (e.g., feat!: or fix(scope)!:) in addition to BREAKING CHANGE footers.

  Breaking changes from both notations are normalized into the notes
  array by the parser, so we now check notes instead of body/footer
  string matching.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Patch Changes

- migrate from semantic-release to release-please (#18)

  - refactor: migrate from semantic-release to release-please

  Replace semantic-release with release-please for production releases to
  enable PR-based version management with package.json and CHANGELOG.md
  staying in sync with published packages.

  Changes:

  - Remove semantic-release and all related dependencies
  - Add release-please.yml workflow for PR-based production releases
  - Update publish-alpha.yml to use manual versioning (commit count)
  - Update CLAUDE.md documentation for new workflows

  Production releases now:

  1. release-please creates/updates Release PR with version bump
  2. Review and merge Release PR
  3. Merging triggers npm publish

  Alpha releases now:

  - Calculate version from branch name + commit count
  - Publish directly to GitHub Packages with predictable versions

  Benefits:

  - package.json version stays in sync with published packages
  - CHANGELOG.md lives in repository
  - Human review of version bumps before publishing
  - No branch protection conflicts

  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

  - chore: bump version to 1.0.0 to sync with published package
