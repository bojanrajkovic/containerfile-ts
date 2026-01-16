## Phase 2: Changeset Generation Script

**Goal:** Automate changeset creation from conventional commits

**Dependencies:** Phase 1 (Changesets must be configured)

### Task 1: Create scripts directory

**Files:**

- Create: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/scripts/` (directory)

**Step 1: Create the scripts directory**

```bash
mkdir -p scripts
```

**Step 2: Verify directory exists**

```bash
ls -la scripts/
```

Expected: Empty directory listing

---

### Task 2: Create generate-changeset.ts script

**Files:**

- Create: `/Users/brajkovic/Code/containerfile-ts/.worktrees/changesets-ci-cd-migration/scripts/generate-changeset.ts`

**Step 1: Create the script**

Create `scripts/generate-changeset.ts` with this content:

```typescript
/*
MIT License

Copyright (c) 2024 Bob Obringer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Adapted from grounds project, simplified for single-package repository

import { execSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import commitParser, { type Commit } from "conventional-commits-parser";

type UpgradeType = "major" | "minor" | "patch" | "none";

type CommitInfo = {
  sha: string;
  commitMessage: Commit;
  isBreakingChange: boolean;
  upgradeType: UpgradeType;
};

// Pattern to identify breaking changes in commit messages
const BREAKING_PATTERN = "BREAKING CHANGE";

// Mapping of commit types to corresponding upgrade types
const bumpMap: Record<string, UpgradeType> = {
  feat: "minor",
  fix: "patch",
  refactor: "patch",
  perf: "patch",
};

/**
 * Main function to generate changesets based on version bump commits.
 */
export async function generateChangeset({
  productionBranch = "main",
  integrationBranch = "HEAD",
}: {
  productionBranch?: string;
  integrationBranch?: string;
} = {}): Promise<void> {
  const packageName = await getPackageName();
  const versionBumpCommits = getVersionBumpCommitsSinceMain({
    productionBranch,
    integrationBranch,
  });
  await createChangesets(versionBumpCommits, packageName);
}

/**
 * Get the package name from package.json
 */
async function getPackageName(): Promise<string> {
  const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
  return packageJson.name;
}

/**
 * Find the most recent version tag in the repository.
 * @returns The tag name, or null if no tags found.
 */
function findLastVersionTag(): string | null {
  try {
    const tag = execSync("git describe --tags --abbrev=0 2>/dev/null").toString().trim();
    return tag || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves version bump commits since the specified base.
 */
function getVersionBumpCommitsSinceMain({
  productionBranch,
  integrationBranch,
}: {
  productionBranch: string;
  integrationBranch: string;
}): CommitInfo[] {
  const delimiter = "<!--|COMMIT|-->";

  let commitRange: string;
  if (integrationBranch === "HEAD") {
    const lastTag = findLastVersionTag();
    if (lastTag) {
      commitRange = `${lastTag}..HEAD`;
      console.log(`Generating changesets for commits since tag: ${lastTag}`);
    } else {
      console.log("No version tags found. Generating changesets for recent commits.");
      commitRange = `${productionBranch}~10..${productionBranch}`;
    }
  } else {
    commitRange = `${productionBranch}..${integrationBranch}`;
  }

  const output = execSync(`git log --format="%H %B${delimiter}" ${commitRange}`).toString().trim();

  if (!output) {
    console.log("No commits found in range.");
    return [];
  }

  return output
    .split(delimiter)
    .slice(0, -1)
    .map((commitText) => parseCommit(commitText))
    .filter(({ upgradeType }) => upgradeType !== "none");
}

/**
 * Parses a commit message and extracts relevant information.
 */
function parseCommit(commitText: string): CommitInfo {
  const commit = commitText.trim();
  const sha = commit.substring(0, 40);
  const message = commit.substring(40).trim();
  const commitMessage = commitParser.sync(message);
  const isBreakingChange = Boolean(
    commitMessage.body?.includes(BREAKING_PATTERN) ??
    commitMessage.footer?.includes(BREAKING_PATTERN),
  );
  const upgradeType = isBreakingChange ? "major" : bumpMap[commitMessage.type ?? ""] || "none";

  return {
    sha,
    commitMessage,
    isBreakingChange,
    upgradeType,
  };
}

/**
 * Creates changeset files for the given commits.
 */
async function createChangesets(commits: CommitInfo[], packageName: string): Promise<void> {
  const changesetDir = join(process.cwd(), ".changeset");
  await mkdir(changesetDir, { recursive: true });
  await Promise.all(commits.map((commit) => createChangeset(commit, changesetDir, packageName)));
}

/**
 * Creates a changeset file for a single commit.
 */
async function createChangeset(
  commit: CommitInfo,
  dir: string,
  packageName: string,
): Promise<void> {
  const changesetContent = getChangesetMarkdown(commit, packageName);
  const changesetFile = join(dir, `${commit.sha}.md`);
  try {
    await writeFile(changesetFile, changesetContent, "utf8");
    console.log(`Created changeset: ${changesetFile}`);
  } catch (error) {
    console.error(`Error creating changeset for commit ${commit.sha}:`, error);
  }
}

/**
 * Generates the content of a changeset file in markdown format.
 */
function getChangesetMarkdown(commit: CommitInfo, packageName: string): string {
  const {
    upgradeType,
    commitMessage: { subject, body, footer },
  } = commit;

  const message = [subject, body, footer].filter(Boolean).join("\n\n");

  return `---
"${packageName}": ${upgradeType}
---
${message}
`;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  productionBranch: string;
  integrationBranch: string;
} {
  let productionBranch = "main";
  let integrationBranch = "HEAD";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-p":
      case "--production":
        productionBranch = args[++i] ?? "main";
        break;
      case "-i":
      case "--integration":
        integrationBranch = args[++i] ?? "develop";
        break;
      case "--help":
      case "-h":
        console.log(`
generate-changeset - Generate changesets from conventional commits

Usage: generate-changeset [options]

Options:
  -p, --production <branch>    Production branch (default: main)
  -i, --integration <branch>   Integration branch or HEAD (default: HEAD)
                               Use HEAD for direct-to-main workflow (finds commits since last tag)
                               Use a branch name (e.g., develop) for main..develop workflow
  -h, --help                   Show this help message

Examples:
  # Direct-to-main workflow (recommended)
  generate-changeset -p main -i HEAD

  # Traditional main/develop workflow
  generate-changeset -p main -i develop
`);
        process.exit(0);
    }
  }

  return { productionBranch, integrationBranch };
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await generateChangeset(args);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
```

**Step 2: Verify script syntax is correct**

Run: `pnpm typecheck`

Expected: No TypeScript errors

**Step 3: Test the script runs**

Run: `pnpm exec tsx scripts/generate-changeset.ts --help`

Expected: Help output showing usage information

**Step 4: Commit**

```bash
git add scripts/
git commit -m "$(cat <<'EOF'
feat: add generate-changeset script for conventional commits

Creates changesets automatically from conventional commit messages.
Adapted from grounds project, simplified for single-package repo.

Commit type mapping:
- feat: minor bump
- fix/refactor/perf: patch bump
- BREAKING CHANGE: major bump
- chore/docs/test/ci: ignored (no changeset)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

**Phase 2 Complete When:**

- `scripts/generate-changeset.ts` exists
- `pnpm exec tsx scripts/generate-changeset.ts --help` shows usage
- TypeScript compilation succeeds
