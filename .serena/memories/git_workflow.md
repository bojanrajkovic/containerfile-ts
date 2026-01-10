# Git Workflow

## Trunk-Based Development

This project uses trunk-based development with the `main` branch as the trunk.

### Workflow Steps:
1. Create a feature branch from `main`
2. Make commits per logical change
3. Squash merge back to `main` with a descriptive message

### Branch Naming:
- `feature/description` - For new features
- `fix/description` - For bug fixes
- `chore/description` - For maintenance work

## Conventional Commits

**All commit messages MUST follow the Conventional Commits format:**

```
<type>[optional scope]: <description>

[optional body]
```

### Types:
- `feat:` - New feature (adds functionality)
- `fix:` - Bug fix (fixes broken functionality)
- `chore:` - Maintenance tasks, dependencies, tooling
- `docs:` - Documentation only changes
- `test:` - Adding or updating tests
- `refactor:` - Code changes that don't add features or fix bugs

### Examples:
```bash
git commit -m "feat: add support for HEALTHCHECK instruction"
git commit -m "fix: validate port range in expose() function"
git commit -m "chore: update vitest to v3.0"
git commit -m "docs: add examples for multi-stage builds"
git commit -m "test: add fixture for COPY --from option"
git commit -m "refactor: simplify render logic for RUN instruction"
```

## Git Hooks (Husky)

### pre-commit Hook
Runs: `pnpm lint:fix`
- Automatically fixes linting issues before commit
- If unfixable issues exist, the commit is blocked

### pre-push Hook
Runs: `pnpm typecheck && pnpm test`
- Ensures type-checking passes
- Ensures all tests pass
- Blocks push if either fails

### Override Hooks (Emergency Only)
If you need to bypass hooks (not recommended):
```bash
git commit --no-verify -m "message"
git push --no-verify
```

## Merge Guidelines

### Squash Merge to Main
- **Always squash merge** feature branches to main
- Keeps history clean and linear
- Each merge represents one logical change

### Commit Message Format for Merge
- **Describe what was built**, not implementation details
- **Don't reference phase numbers** or implementation plans
- Focus on the "what" and "why", not the "how"

**Good:**
```
feat: add multi-stage build support

Adds stage() factory function and multi-stage rendering.
Supports named stages with FROM ... AS syntax.
```

**Bad:**
```
feat: complete phase 5 of implementation plan

Implemented steps 5.1 through 5.7 from the plan.
```

## Branch Cleanup
After squash merging to main:
```bash
git checkout main
git pull
git branch -d feature/my-feature  # Delete local branch
```

## Working with Remotes
```bash
git fetch origin              # Fetch latest changes
git pull origin main          # Pull latest main
git push origin feature/name  # Push feature branch
```

## Status Checking
```bash
git status                    # Check working directory status
git log --oneline -n 10       # View recent commits
git diff                      # See unstaged changes
git diff --staged             # See staged changes
```
