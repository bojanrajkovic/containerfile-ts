## Phase 3: Workflow Architecture

**Goal:** Implement publish-switch routing and reusable workflows

**Dependencies:** Phase 2 (script must exist for release workflow)

### Task 1: Create publish-switch.yml entry point

**Files:**

- Create: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.github/workflows/publish-switch.yml`

**Step 1: Create the workflow file**

Create `.github/workflows/publish-switch.yml`:

```yaml
name: Publish Packages

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches:
      - "**/feat/**"
      - "**/fix/**"
  push:
    branches:
      - main

jobs:
  publish-alpha:
    # Trigger on feat/ or fix/ anywhere in branch name (e.g., brajkovic/feat/something)
    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && (contains(github.event.workflow_run.head_branch, '/feat/') || contains(github.event.workflow_run.head_branch, '/fix/'))
    uses: ./.github/workflows/publish-alpha.yml
    permissions:
      id-token: write
      contents: read
    secrets: inherit

  publish-release:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    uses: ./.github/workflows/publish-release.yml
    permissions:
      id-token: write
      contents: write
      pull-requests: write
    secrets: inherit
```

This is the single OIDC entry point that routes to the appropriate workflow based on the trigger:

- `workflow_run` on feat/fix branches → `publish-alpha.yml`
- `push` to main → `publish-release.yml`

**Step 2: Verify YAML syntax**

Run: `cat .github/workflows/publish-switch.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin); print('Valid YAML')"`

Expected: "Valid YAML"

**Step 3: Commit**

```bash
git add .github/workflows/publish-switch.yml
git commit -m "$(cat <<'EOF'
ci: add publish-switch.yml as OIDC entry point

Routes to alpha or release workflows based on trigger:
- workflow_run on feat/fix branches → publish-alpha.yml
- push to main → publish-release.yml

Matches grounds project pattern for single OIDC trusted publisher.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create new publish-alpha.yml workflow

**Files:**

- Modify: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.github/workflows/publish-alpha.yml`

**Step 1: Replace the entire workflow file**

Replace `.github/workflows/publish-alpha.yml` with this content:

```yaml
name: Publish Alpha Packages

on:
  workflow_call:

jobs:
  publish-alpha:
    runs-on: ubuntu-latest

    permissions:
      id-token: write
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup mise
        uses: jdx/mise-action@v2

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build package
        run: pnpm build

      - name: Extract branch name and commit SHA
        run: |
          BRANCH_NAME="${{ github.event.workflow_run.head_branch }}"
          # Remove feat/ or fix/ prefix, handle nested paths like brajkovic/feat/something
          SANITIZED_BRANCH=$(echo "$BRANCH_NAME" | sed 's|.*/feat/||' | sed 's|.*/fix/||' | sed 's|feat/||' | sed 's|fix/||' | sed 's|/|-|g')
          SHORT_SHA=$(echo "${{ github.event.workflow_run.head_sha }}" | cut -c1-7)
          echo "SNAPSHOT_TAG=${SANITIZED_BRANCH}-${SHORT_SHA}" >> $GITHUB_ENV

      - name: Create snapshot version
        run: pnpm exec changeset version --snapshot ${{ env.SNAPSHOT_TAG }}

      - name: Publish alpha packages
        run: pnpm exec changeset publish --tag alpha
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

Key changes from old workflow:

- Now a reusable workflow (`workflow_call`)
- Uses Changesets for versioning (`changeset version --snapshot`)
- Uses Changesets for publishing (`changeset publish --tag alpha`)
- Publishes to npm (not GitHub Packages)
- Version format: `{version}-{branch}-{sha}` instead of `{version}-{branch}.{count}`

**Authentication note:** The workflow uses `NPM_TOKEN` secret for npm authentication. This is required by changesets/action. The `id-token: write` permission enables npm provenance attestation (OIDC), while `NPM_TOKEN` handles the actual publish authentication. Both are needed for full functionality.

**Step 2: Verify YAML syntax**

Run: `cat .github/workflows/publish-alpha.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin); print('Valid YAML')"`

Expected: "Valid YAML"

**Step 3: Commit**

```bash
git add .github/workflows/publish-alpha.yml
git commit -m "$(cat <<'EOF'
ci: update publish-alpha to use changesets and npm

Changes:
- Convert to reusable workflow (workflow_call)
- Use changeset version --snapshot for versioning
- Use changeset publish --tag alpha for publishing
- Publish to npm (not GitHub Packages)
- Version format: {version}-{branch}-{sha}

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create publish-release.yml workflow

**Files:**

- Create: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/.github/workflows/publish-release.yml`

**Step 1: Create the workflow file**

Create `.github/workflows/publish-release.yml`:

```yaml
name: Publish Release Packages

on:
  workflow_call:

jobs:
  publish-release:
    runs-on: ubuntu-latest

    permissions:
      id-token: write
      contents: write
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup mise
        uses: jdx/mise-action@v2

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build package
        run: pnpm build

      - name: Check if this is a release commit
        id: check-release
        run: |
          COMMIT_MSG=$(git log -1 --pretty=%B)
          if [[ "$COMMIT_MSG" == "chore(release): version packages"* ]]; then
            echo "is_release=true" >> $GITHUB_OUTPUT
            echo "Skipping changeset generation - this is a release commit"
          else
            echo "is_release=false" >> $GITHUB_OUTPUT
          fi

      - name: Generate changesets from conventional commits
        if: steps.check-release.outputs.is_release != 'true'
        run: pnpm exec tsx scripts/generate-changeset.ts -p main -i HEAD

      - name: Check for releasable changesets
        id: check-changesets
        run: |
          # Check if any changesets would cause version bumps
          # Changesets with "none" bump type don't count
          if grep -r '"@bojanrajkovic/containerfile-ts": \(major\|minor\|patch\)' .changeset/*.md 2>/dev/null; then
            echo "has_changesets=true" >> $GITHUB_OUTPUT
            echo "Found releasable changesets"
          else
            echo "has_changesets=false" >> $GITHUB_OUTPUT
            echo "No releasable changesets (only chore/docs/test commits)"
          fi

      - name: Create Release Pull Request or Publish
        if: steps.check-changesets.outputs.has_changesets == 'true'
        uses: changesets/action@v1
        with:
          version: pnpm run changeset-version
          publish: pnpm run release
          commit: "chore(release): version packages"
          title: "chore(release): version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

This workflow:

1. Checks if the commit is a release commit (skips changeset generation)
2. Generates changesets from conventional commits since last tag
3. Checks if there are releasable changesets (feat/fix commits)
4. Uses `changesets/action` to create a "Version Packages" PR or publish

**Step 2: Verify YAML syntax**

Run: `cat .github/workflows/publish-release.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin); print('Valid YAML')"`

Expected: "Valid YAML"

**Step 3: Commit**

```bash
git add .github/workflows/publish-release.yml
git commit -m "$(cat <<'EOF'
ci: add publish-release workflow with changesets

Implements the production release flow:
1. Generates changesets from conventional commits
2. Checks for releasable changes (feat/fix, not chore/docs)
3. Creates "Version Packages" PR via changesets/action
4. Publishes to npm on PR merge

Uses generate-changeset.ts to convert conventional commits.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

**Phase 3 Complete When:**

- `publish-switch.yml` exists and routes correctly
- `publish-alpha.yml` uses changesets for snapshot versioning
- `publish-release.yml` uses generate-changeset.ts and changesets/action
- All YAML files pass syntax validation
