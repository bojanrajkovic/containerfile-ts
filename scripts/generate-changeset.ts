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

// pattern: Imperative Shell

// Adapted from grounds project, simplified for single-package repository

import { execSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CommitParser } from "conventional-commits-parser";

type UpgradeType = "major" | "minor" | "patch" | "none";

type CommitNote = {
  readonly title: string;
  readonly text: string;
};

type CommitMessage = {
  readonly type: string | null;
  readonly scope: string | null;
  readonly subject: string;
  readonly body: string | null;
  readonly footer: string | null;
  readonly notes: ReadonlyArray<CommitNote>;
};

type CommitInfo = {
  readonly sha: string;
  readonly commitMessage: CommitMessage;
  readonly isBreakingChange: boolean;
  readonly upgradeType: UpgradeType;
};

// Parser options for conventional commits with breaking change support
const PARSER_OPTIONS = {
  headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
  breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  headerCorrespondence: ["type", "scope", "subject"],
  noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
};

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
}): Array<CommitInfo> {
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
  const parser = new CommitParser(PARSER_OPTIONS);
  const parsed = parser.parse(message);

  // Check for breaking changes via notes array (handles both "feat!:" and "BREAKING CHANGE:" footer)
  const isBreakingChange = parsed.notes.some(
    (note) => note.title === "BREAKING CHANGE" || note.title === "BREAKING-CHANGE",
  );
  const upgradeType = isBreakingChange ? "major" : bumpMap[parsed.type ?? ""] || "none";

  return {
    sha,
    commitMessage: {
      type: parsed.type,
      scope: parsed.scope,
      subject: parsed.subject ?? "",
      body: parsed.body,
      footer: parsed.footer,
      notes: parsed.notes.map((note) => ({ title: note.title, text: note.text })),
    },
    isBreakingChange,
    upgradeType,
  };
}

/**
 * Creates changeset files for the given commits.
 */
async function createChangesets(
  commits: ReadonlyArray<CommitInfo>,
  packageName: string,
): Promise<void> {
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
function parseArgs(args: ReadonlyArray<string>): {
  productionBranch: string;
  integrationBranch: string;
} {
  type ParseState = {
    readonly index: number;
    readonly productionBranch: string;
    readonly integrationBranch: string;
  };

  const reduce = (state: ParseState): ParseState => {
    if (state.index >= args.length) {
      return state;
    }

    const arg = args[state.index];
    switch (arg) {
      case "-p":
      case "--production": {
        const value = args[state.index + 1] ?? "main";
        return reduce({
          ...state,
          productionBranch: value,
          index: state.index + 2,
        });
      }
      case "-i":
      case "--integration": {
        const value = args[state.index + 1] ?? "develop";
        return reduce({
          ...state,
          integrationBranch: value,
          index: state.index + 2,
        });
      }
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
      default:
        return reduce({ ...state, index: state.index + 1 });
    }
  };

  const finalState = reduce({
    index: 0,
    productionBranch: "main",
    integrationBranch: "HEAD",
  });

  return {
    productionBranch: finalState.productionBranch,
    integrationBranch: finalState.integrationBranch,
  };
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await generateChangeset(args);
}

main().catch((error) => {
  console.error("failed to generate changeset:", error);
  process.exit(1);
});
