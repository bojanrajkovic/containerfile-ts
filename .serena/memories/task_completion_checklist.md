# Task Completion Checklist

When you complete a coding task in containerfile-ts, follow this checklist:

## 1. Type-Check
```bash
pnpm typecheck
```
Ensure no TypeScript errors. The project uses extremely strict TypeScript settings, so all code must satisfy:
- Strict null checks
- No implicit any
- No unused locals/parameters
- No unchecked indexed access
- All other strict mode settings

## 2. Run Tests
```bash
pnpm test
```
All tests must pass. The project uses fixture-based testing where each test:
- Has a `generator.ts` file that exports a containerfile definition
- Has an `expected.Dockerfile` file with the expected output
- Compares the rendered output to the expected output

## 3. Lint the Code
```bash
pnpm lint
```
Check for linting issues. If there are any, run:
```bash
pnpm lint:fix
```
The linter (oxlint) will auto-fix most issues.

## 4. Build the Project
```bash
pnpm build
```
Ensure the TypeScript compilation succeeds and produces output in `dist/`.

## 5. Verify FCIS Pattern
Check that any new or modified files have the correct pattern comment:
- Production code in `src/`: `// pattern: Functional Core`
- Test code in `tests/`: `// pattern: Imperative Shell`

Verify that:
- Production code has no side effects (no I/O, no mutations)
- All fields in types are `readonly`
- All arrays in parameters are `ReadonlyArray<T>`

## 6. Update Documentation (if needed)
If you changed the public API, update:
- `README.md` - Usage examples and API reference
- `CLAUDE.md` - Project documentation for AI assistants
- ADRs (if architectural decisions were made)

## 7. Commit with Conventional Commits
Use the conventional commit format:
```bash
git commit -m "type: description"
```

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance, dependencies, tooling
- `docs:` - Documentation only
- `test:` - Adding or updating tests
- `refactor:` - Code changes that don't add features or fix bugs

## Git Hooks (Automatic)
The following hooks run automatically:
- **pre-commit**: Runs `pnpm lint:fix` to auto-fix linting issues
- **pre-push**: Runs `pnpm typecheck && pnpm test` to ensure code quality

If the pre-push hook fails, fix the issues before pushing.

## Summary Command
Run all checks at once:
```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm build
```

If all of these succeed, the task is complete and ready to commit.
