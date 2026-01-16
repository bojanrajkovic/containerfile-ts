## Phase 5: Migration and Cleanup

**Goal:** Remove old release infrastructure, configure npm OIDC

**Dependencies:** Phases 3 and 4 (new workflows must be in place)

### Task 1: Remove release-please.yml

**Files:**

- Delete: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.github/workflows/release-please.yml`

**Step 1: Delete the file**

```bash
rm .github/workflows/release-please.yml
```

**Step 2: Verify file is gone**

```bash
ls .github/workflows/
```

Expected: Should show ci.yml, dependency-review.yml, pr-title.yml, publish-alpha.yml, publish-release.yml, publish-switch.yml (no release-please.yml)

**Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
ci: remove release-please.yml

Replaced by changesets-based publish-release.yml workflow.
The publish-switch.yml is now the OIDC entry point.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update .npmrc to remove GitHub Packages config

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.npmrc`

**Step 1: Replace .npmrc contents**

Replace `.npmrc` with:

```
# All packages published to npm public registry
# OIDC authentication handled by GitHub Actions (no NPM_TOKEN needed for releases)
# Alpha packages also go to npm with @alpha tag
```

The GitHub Packages configuration is no longer needed since:

- Alpha packages now go to npm (not GitHub Packages)
- Release packages already went to npm
- OIDC handles authentication

**Step 2: Verify .npmrc is updated**

```bash
cat .npmrc
```

Expected: Shows the new comments, no GitHub Packages config

**Step 3: Commit**

```bash
git add .npmrc
git commit -m "$(cat <<'EOF'
chore: remove GitHub Packages config from .npmrc

Alpha packages now publish to npm with @alpha tag.
No longer using GitHub Packages for pre-releases.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update CLAUDE.md with new workflow documentation

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/CLAUDE.md`

**Step 1: Update the CI/CD Workflows section**

Find the "## CI/CD Workflows" section in CLAUDE.md and replace it with:

```markdown
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
```

**Step 2: Update the npm OIDC Trusted Publishing section**

Find the "## npm OIDC Trusted Publishing" section and update the setup instructions:

```markdown
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
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: update CLAUDE.md for changesets workflow

Updates CI/CD Workflows section to document:
- publish-switch.yml as OIDC entry point
- Changesets-based release flow
- Alpha packages on npm (not GitHub Packages)
- generate-changeset.ts for conventional commits

Updates npm OIDC section with new workflow name.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Document npm OIDC update requirement

**Note:** This is a manual step that the user must perform outside of code changes.

**Step 1: Create a reminder issue or note**

After all code changes are merged, the user must:

1. Go to https://www.npmjs.com/package/@bojanrajkovic/containerfile-ts/access
2. Update the trusted publisher workflow from `release-please.yml` to `publish-switch.yml`

This cannot be automated and must be done manually by the package owner.

**Step 2: Commit final state marker**

```bash
git add -A
git status
```

If there are any uncommitted changes, commit them:

```bash
git commit -m "$(cat <<'EOF'
chore: complete changesets migration

Migration complete. Manual step required:
Update npm trusted publisher workflow from release-please.yml to publish-switch.yml
at https://www.npmjs.com/package/@bojanrajkovic/containerfile-ts/access

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

**Phase 5 Complete When:**

- `release-please.yml` is deleted
- `.npmrc` has no GitHub Packages config
- `CLAUDE.md` documents new workflow architecture
- User is aware of manual npm OIDC update requirement
- All changes are committed

---

## Post-Implementation Checklist

After all phases are complete:

1. **Push branch and create PR**

   ```bash
   git push -u origin brajkovic/changesets-ci-cd-migration
   gh pr create --title "feat: migrate to changesets for release management" --body "..."
   ```

2. **Verify CI passes** - The new format:check step should pass

3. **Manual step after merge:** Update npm trusted publisher to `publish-switch.yml`

4. **Test alpha publishing:** Create a feat/ branch and verify alpha publishes to npm

5. **Test release publishing:** Merge a feat: commit to main and verify "Version Packages" PR is created
