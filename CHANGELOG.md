# @bojanrajkovic/containerfile-ts

## 3.0.0

### Major Changes

- add TypeBox validation and Result types for factory functions (#31)
  - chore: add typebox and neverthrow dependencies

  - feat: add ValidationError type and error helpers

  - feat: add primitive schemas with branded types

  - test: add primitive schema validator tests

  - fix: address code formatting violations
  * Fixed formatting in package.json (dependencies ordering)
  * Fixed formatting in src/errors.ts (line length)
  * Fixed formatting in src/schemas/primitives.ts (line breaks and indentation)
  * Fixed formatting in tests/schemas/primitives.test.ts (whitespace)
  * All files reformatted with oxfmt to pass format:check

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat: add port range validation with error collection

  - feat: add string and string array validators

  - feat: add optional value validation helper

  - feat: migrate from() to return Result type

  - feat: migrate workdir, env, label, arg to return Result

  - feat: migrate run, cmd, entrypoint to return Result

  - feat: migrate copy, add to return Result with full validation

  - feat: migrate expose to return Result, remove throwing validatePort

  - fix: address code review feedback for API exports and type consistency
  * Export ValidationError type from public API for error handling
  * Export Result, ok, err from neverthrow for consumer convenience
  * Update CopyInstruction.src type to ReadonlyArray<string> for consistency
  * Update AddInstruction.src type to ReadonlyArray<string> for consistency
  * Update render functions to work with normalized array types

  All factory functions return Result types with array-normalized src values,
  so the instruction types now accurately reflect the actual contract.

  Fixes:
  - Important Issue 1: ValidationError not exported from public API
  - Important Issue 2: Result, ok, err not re-exported from neverthrow
  - Minor Issue 1: CopyInstruction.src type inconsistency
  - Minor Issue 2: AddInstruction.src type inconsistency

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat: migrate stage() to return Result with error collection

  - feat: simplify containerfile() API to accept Result arrays

  - refactor: update fixtures to use new Result-based API

  - feat: update public exports with Result types and validation

  - docs: update JSDoc comments for Result-based API

  - docs: update CLAUDE.md with Result-based API contracts

  - chore: format test files

  - chore: add fast-check for property-based testing

  - test: add property-based tests for port validation

  - test: add property-based tests for string validation

  - test: add property-based tests for image name validation

  - test: add property-based roundtrip tests for factory functions

  - test: remove unused import in property tests

  - docs: update project context for TypeBox validation implementation

  Update CLAUDE.md to document:
  - New src/schemas/ directory with TypeBox schemas and validators
  - Branded types (Port, ImageName, DockerPath, PortRange)
  - Runtime dependencies (TypeBox, neverthrow)
  - Dev dependencies (fast-check)
  - New test files for unit and property-based testing
  - Expanded Testing section with unit and property-based testing

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - chore: fix formatting in property tests and CLAUDE.md

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - fix: generate changesets in alpha publish workflow

  Add step to call generate-changeset.ts before running changeset version --snapshot.
  This ensures changesets exist for the snapshot versioning to work.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat!: add typebox validation with result types

  Placeholder commit for changeset generation.

  BREAKING CHANGE: Factory functions now return Result types from neverthrow.
  Callers must handle Results using .isOk()/.isErr() or .match().

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: add guidance for marking breaking changes in commits

  Explains how to use `!` suffix or `BREAKING CHANGE:` footer
  to ensure generate-changeset.ts detects major version bumps.
  - chore: add markdown formatting to lint-staged

  - chore: format markdown files

  - chore: fix design document box formatting

  oh, claude.
  - fix: address Copilot review comments on runtime validation
  * Add validateString() for runtime type checking (allows empty strings)
  * Add runtime validation to env() value parameter
  * Add runtime validation to label() value parameter
  * Add runtime validation to arg() defaultValue parameter
  * Fix incorrect copy() example in containerfile JSDoc

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: fix multi-stage build examples in JSDoc

  The multi-stage build examples were missing { as: "builder" } in the
  FROM instruction. Without this, COPY --from=builder would fail because
  the stage name only exists in the rendered output when FROM has AS.

  Updated:
  - containerfile() example to include { as: "builder" }
  - stage() example to include { as: "builder" }
  - stage() JSDoc to clarify that FROM's as option is needed for --from

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - chore: remove section header comments from index.ts

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: update TSDoc examples to use idiomatic neverthrow match()

  - refactor: use Result.combineWithAllErrors for error collection

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: use ReadonlyArray consistently to avoid defensive copies

  Changed validator return types from Array<string> to ReadonlyArray<string>,
  eliminating unnecessary [...spread] copies since instruction types already
  expect ReadonlyArray<string>.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - fix: add defensive type guards for JS callers bypassing TypeScript

  Add runtime checks to handle cases where JavaScript callers or
  TypeScript casts bypass type checking:
  - validateDockerPathArray: check Array.isArray before .map()
  - expose(): check for null/primitives before accessing .start/.end
  - containerfile(): check Array.isArray before iteration
  - validateInstructionResults(): check Array.isArray before .map()

  Introduces isReadonlyArray<T> helper that preserves generic types
  unlike Array.isArray() which widens to any[].

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: use idiomatic neverthrow patterns instead of isErr/isOk

  Replace manual if (result.isErr()) checks with:
  - .map() for simple transformations
  - .match() for branching logic

  This is more idiomatic neverthrow usage and provides better
  type safety through the Result combinators.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat: add shell form support to cmd and entrypoint

  Both cmd() and entrypoint() now accept string | ReadonlyArray<string>,
  matching the run() function API. Shell form renders as plain string,
  exec form renders as JSON array.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - chore: remove section header comments from primitives.ts

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: fix type inference for array of instructions vs. stages

  - docs: update cmd and entrypoint signatures for shell form support

  Update CLAUDE.md to reflect that cmd() and entrypoint() now accept
  string | ReadonlyArray<string>, matching run()'s flexibility for
  both shell and exec forms.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: remove isOk/isErr antipattern from error handling examples

  Replace manual isOk()/isErr() checks with idiomatic neverthrow patterns:
  pattern matching via .match() and chainable methods like .map() and
  .mapErr(). Add explicit guidance to never use manual property access.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: remove internal utilities from public API

  Remove ok, err, validationError, and prefixErrors from exports.
  These are internal implementation details - consumers only need
  the Result and ValidationError types for annotations.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

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

## 2.0.0

### Major Changes

- add TypeBox validation and Result types for factory functions (#31)
  - chore: add typebox and neverthrow dependencies

  - feat: add ValidationError type and error helpers

  - feat: add primitive schemas with branded types

  - test: add primitive schema validator tests

  - fix: address code formatting violations
  * Fixed formatting in package.json (dependencies ordering)
  * Fixed formatting in src/errors.ts (line length)
  * Fixed formatting in src/schemas/primitives.ts (line breaks and indentation)
  * Fixed formatting in tests/schemas/primitives.test.ts (whitespace)
  * All files reformatted with oxfmt to pass format:check

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat: add port range validation with error collection

  - feat: add string and string array validators

  - feat: add optional value validation helper

  - feat: migrate from() to return Result type

  - feat: migrate workdir, env, label, arg to return Result

  - feat: migrate run, cmd, entrypoint to return Result

  - feat: migrate copy, add to return Result with full validation

  - feat: migrate expose to return Result, remove throwing validatePort

  - fix: address code review feedback for API exports and type consistency
  * Export ValidationError type from public API for error handling
  * Export Result, ok, err from neverthrow for consumer convenience
  * Update CopyInstruction.src type to ReadonlyArray<string> for consistency
  * Update AddInstruction.src type to ReadonlyArray<string> for consistency
  * Update render functions to work with normalized array types

  All factory functions return Result types with array-normalized src values,
  so the instruction types now accurately reflect the actual contract.

  Fixes:
  - Important Issue 1: ValidationError not exported from public API
  - Important Issue 2: Result, ok, err not re-exported from neverthrow
  - Minor Issue 1: CopyInstruction.src type inconsistency
  - Minor Issue 2: AddInstruction.src type inconsistency

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat: migrate stage() to return Result with error collection

  - feat: simplify containerfile() API to accept Result arrays

  - refactor: update fixtures to use new Result-based API

  - feat: update public exports with Result types and validation

  - docs: update JSDoc comments for Result-based API

  - docs: update CLAUDE.md with Result-based API contracts

  - chore: format test files

  - chore: add fast-check for property-based testing

  - test: add property-based tests for port validation

  - test: add property-based tests for string validation

  - test: add property-based tests for image name validation

  - test: add property-based roundtrip tests for factory functions

  - test: remove unused import in property tests

  - docs: update project context for TypeBox validation implementation

  Update CLAUDE.md to document:
  - New src/schemas/ directory with TypeBox schemas and validators
  - Branded types (Port, ImageName, DockerPath, PortRange)
  - Runtime dependencies (TypeBox, neverthrow)
  - Dev dependencies (fast-check)
  - New test files for unit and property-based testing
  - Expanded Testing section with unit and property-based testing

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - chore: fix formatting in property tests and CLAUDE.md

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - fix: generate changesets in alpha publish workflow

  Add step to call generate-changeset.ts before running changeset version --snapshot.
  This ensures changesets exist for the snapshot versioning to work.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat!: add typebox validation with result types

  Placeholder commit for changeset generation.

  BREAKING CHANGE: Factory functions now return Result types from neverthrow.
  Callers must handle Results using .isOk()/.isErr() or .match().

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: add guidance for marking breaking changes in commits

  Explains how to use `!` suffix or `BREAKING CHANGE:` footer
  to ensure generate-changeset.ts detects major version bumps.
  - chore: add markdown formatting to lint-staged

  - chore: format markdown files

  - chore: fix design document box formatting

  oh, claude.
  - fix: address Copilot review comments on runtime validation
  * Add validateString() for runtime type checking (allows empty strings)
  * Add runtime validation to env() value parameter
  * Add runtime validation to label() value parameter
  * Add runtime validation to arg() defaultValue parameter
  * Fix incorrect copy() example in containerfile JSDoc

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: fix multi-stage build examples in JSDoc

  The multi-stage build examples were missing { as: "builder" } in the
  FROM instruction. Without this, COPY --from=builder would fail because
  the stage name only exists in the rendered output when FROM has AS.

  Updated:
  - containerfile() example to include { as: "builder" }
  - stage() example to include { as: "builder" }
  - stage() JSDoc to clarify that FROM's as option is needed for --from

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - chore: remove section header comments from index.ts

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: update TSDoc examples to use idiomatic neverthrow match()

  - refactor: use Result.combineWithAllErrors for error collection

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: use ReadonlyArray consistently to avoid defensive copies

  Changed validator return types from Array<string> to ReadonlyArray<string>,
  eliminating unnecessary [...spread] copies since instruction types already
  expect ReadonlyArray<string>.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - fix: add defensive type guards for JS callers bypassing TypeScript

  Add runtime checks to handle cases where JavaScript callers or
  TypeScript casts bypass type checking:
  - validateDockerPathArray: check Array.isArray before .map()
  - expose(): check for null/primitives before accessing .start/.end
  - containerfile(): check Array.isArray before iteration
  - validateInstructionResults(): check Array.isArray before .map()

  Introduces isReadonlyArray<T> helper that preserves generic types
  unlike Array.isArray() which widens to any[].

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: use idiomatic neverthrow patterns instead of isErr/isOk

  Replace manual if (result.isErr()) checks with:
  - .map() for simple transformations
  - .match() for branching logic

  This is more idiomatic neverthrow usage and provides better
  type safety through the Result combinators.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - feat: add shell form support to cmd and entrypoint

  Both cmd() and entrypoint() now accept string | ReadonlyArray<string>,
  matching the run() function API. Shell form renders as plain string,
  exec form renders as JSON array.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - chore: remove section header comments from primitives.ts

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: fix type inference for array of instructions vs. stages

  - docs: update cmd and entrypoint signatures for shell form support

  Update CLAUDE.md to reflect that cmd() and entrypoint() now accept
  string | ReadonlyArray<string>, matching run()'s flexibility for
  both shell and exec forms.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - docs: remove isOk/isErr antipattern from error handling examples

  Replace manual isOk()/isErr() checks with idiomatic neverthrow patterns:
  pattern matching via .match() and chainable methods like .map() and
  .mapErr(). Add explicit guidance to never use manual property access.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - refactor: remove internal utilities from public API

  Remove ok, err, validationError, and prefixErrors from exports.
  These are internal implementation details - consumers only need
  the Result and ValidationError types for annotations.

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

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
