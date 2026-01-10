# Suggested Commands

## Package Management
```bash
pnpm install              # Install dependencies
```

## Building
```bash
pnpm build               # Compile TypeScript to dist/
pnpm typecheck           # Type-check without emitting files
```

## Testing
```bash
pnpm test                # Run all tests once
pnpm test:watch          # Run tests in watch mode (interactive)
```

## Linting
```bash
pnpm lint                # Check for linting issues
pnpm lint:fix            # Auto-fix linting issues
```

## Git Hooks (Automatic)
```bash
# These run automatically via Husky:
# pre-commit: pnpm lint:fix
# pre-push: pnpm typecheck && pnpm test
```

## Common Development Workflows

### After making code changes:
```bash
pnpm typecheck && pnpm test && pnpm lint
```

### Before committing:
```bash
# The pre-commit hook will auto-run: pnpm lint:fix
git add .
git commit -m "feat: your message"
```

### Before pushing:
```bash
# The pre-push hook will auto-run: pnpm typecheck && pnpm test
git push
```

## macOS (Darwin) Specific Commands
Since the project is developed on macOS, standard Unix commands work:
- `ls`, `cd`, `grep`, `find`, `cat`, etc. all work as expected
- No special macOS-specific quirks for this project

## Project-Specific Commands
This is a library, not an application, so there are no "run" commands. The library is consumed by importing it in other TypeScript projects.

### Example Usage (for testing manually):
```typescript
import { containerfile, from, run, render } from './dist/index.js';

const dockerfile = containerfile({
  instructions: [
    from('node:20-alpine'),
    run('npm install'),
  ],
});

console.log(render(dockerfile));
```
