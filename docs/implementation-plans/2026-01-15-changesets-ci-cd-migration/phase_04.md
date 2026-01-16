## Phase 4: CI Enhancements

**Goal:** Add formatting and upgrade linting

**Dependencies:** None (can run in parallel with Phase 3, but sequenced here for simplicity)

### Task 1: Pin mise versions

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.mise.toml`

**Step 1: Update .mise.toml with pinned versions**

Replace the contents of `.mise.toml`:

```toml
[tools]
node = "24"
pnpm = "10.28.0"
```

Note: Using the latest pnpm version (10.28.0 as of the pnpm update notice during install). Node 24 is the current Active LTS (as of October 2025).

**Step 2: Verify mise uses the pinned versions**

Run: `mise install && mise current`

Expected: Shows `node 24.x.x` and `pnpm 10.28.0`

**Step 3: Commit**

```bash
git add .mise.toml
git commit -m "$(cat <<'EOF'
chore: pin mise tool versions

Pin node to 24 (LTS) and pnpm to 10.28.0 for reproducible builds.
Avoids floating versions causing CI inconsistencies.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Upgrade oxlint and add explicit rules

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/package.json:54`
- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/oxlint.json`

**Step 1: Upgrade oxlint in package.json**

Update the oxlint version in `devDependencies`:

```json
"oxlint": "^1.39.0"
```

(Change from `^0.15.0` to `^1.39.0` - oxlint 1.0 was released in 2025 with 655+ rules)

**Step 2: Add explicit rules to oxlint.json**

Replace the contents of `oxlint.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "ignorePatterns": ["dist", "node_modules"],
  "rules": {
    "no-unused-vars": "error",
    "no-console": "off",
    "eqeqeq": "error"
  }
}
```

Rules explanation:

- `no-unused-vars: error` - Catch unused variables
- `no-console: off` - Allow console.log (useful for CLI scripts)
- `eqeqeq: error` - Require strict equality (=== instead of ==)

**Step 3: Install upgraded oxlint**

Run: `pnpm install`

Expected: oxlint upgraded to 1.39.0+

**Step 4: Verify linting still passes**

Run: `pnpm lint`

Expected: No lint errors (if errors occur, they indicate real issues to fix)

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml oxlint.json
git commit -m "$(cat <<'EOF'
chore: upgrade oxlint and add explicit rules

Upgrade oxlint from 0.15.0 to 1.39.0 (stable release with 655+ rules).
Add explicit rules: no-unused-vars, eqeqeq (error), no-console (off).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add oxfmt formatter

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/package.json:49-57` (devDependencies)
- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/package.json:17-25` (scripts)

**Step 1: Add oxfmt to devDependencies**

Add to `devDependencies` in `package.json`:

```json
"oxfmt": "^0.24.0"
```

**Step 2: Add format scripts to package.json**

Update the `scripts` section to add formatting commands:

```json
{
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "prepare": "husky",
    "changeset": "changeset",
    "changeset-version": "changeset version",
    "release": "pnpm build && pnpm publish --access public --no-git-checks"
  }
}
```

New scripts:

- `format` - Format all files in place
- `format:check` - Check formatting without modifying files

**Step 3: Install oxfmt**

Run: `pnpm install`

Expected: oxfmt installed

**Step 4: Run formatter to establish baseline**

Run: `pnpm format`

Expected: Files formatted (may show changes if formatting differs from current)

**Step 5: Verify format check passes**

Run: `pnpm format:check`

Expected: No formatting issues

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
# Also add any files that were reformatted
git add -A
git commit -m "$(cat <<'EOF'
chore: add oxfmt formatter

Adds oxfmt for consistent code formatting.
New scripts: format (write), format:check (CI validation).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add format check to CI

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.github/workflows/ci.yml:46-47`

**Step 1: Add format:check step before lint**

Insert a new step in `.github/workflows/ci.yml` after "Install dependencies" and before "Run linter":

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Check formatting
  run: pnpm format:check

- name: Run linter
  run: pnpm lint
```

The full updated workflow should have this order:

1. Checkout code
2. Setup mise
3. Get pnpm store directory
4. Setup pnpm cache
5. Install dependencies
6. **Check formatting** (new)
7. Run linter
8. Run type checking
9. Run tests
10. Build project
11. Security audit
12. Verify package signatures

**Step 2: Verify YAML syntax**

Run: `cat .github/workflows/ci.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin); print('Valid YAML')"`

Expected: "Valid YAML"

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: add format check to CI workflow

Adds format:check step before linting to catch formatting issues early.
Fails fast on formatting problems before running other checks.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

**Phase 4 Complete When:**

- `.mise.toml` has pinned versions (node 24, pnpm 10.28.0)
- oxlint upgraded to 1.39.0+ with explicit rules
- oxfmt installed with format/format:check scripts
- CI runs format:check before lint
- `pnpm lint` and `pnpm format:check` both pass
