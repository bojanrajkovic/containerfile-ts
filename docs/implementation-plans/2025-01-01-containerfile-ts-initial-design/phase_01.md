# containerfile-ts Implementation Plan - Phase 1: Project Scaffolding

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Initialize project with mise, pnpm, TypeScript, and basic tooling.

**Architecture:** Standard TypeScript library structure with ESM output, strict compiler settings, and mise-managed tool versions.

**Tech Stack:** Node.js LTS, pnpm, TypeScript 5.7+

**Scope:** Phase 1 of 8 from original design

**Codebase verified:** 2025-01-01 - Confirmed greenfield project with only .gitignore and design plan

---

## Task 1.1: Create mise configuration

**Files:**
- Create: `.mise.toml`

**Step 1: Create mise.toml with Node.js LTS and pnpm**

```toml
[tools]
node = "lts"
pnpm = "latest"
```

**Step 2: Run mise install to verify**

Run: `mise install`
Expected: Node.js LTS and pnpm installed successfully

**Step 3: Verify tools are available**

Run: `node --version && pnpm --version`
Expected: Version numbers displayed

**Step 4: Commit**

```bash
git add .mise.toml
git commit -m "chore: add mise configuration for Node.js and pnpm"
```

---

## Task 1.2: Create package.json

**Files:**
- Create: `package.json`

**Step 1: Create package.json with project metadata**

```json
{
  "name": "containerfile-ts",
  "version": "0.0.1",
  "description": "Type-safe Dockerfile/Containerfile generation with declarative TypeScript",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "dockerfile",
    "containerfile",
    "docker",
    "container",
    "typescript",
    "type-safe"
  ],
  "author": "Bojan Rajkovic",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/brajkovic/containerfile-ts.git"
  },
  "engines": {
    "node": ">=20"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add package.json with project metadata"
```

---

## Task 1.3: Create tsconfig.json

**Files:**
- Create: `tsconfig.json`

**Step 1: Create strict TypeScript configuration**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add strict TypeScript configuration"
```

---

## Task 1.4: Create empty entry point and install dependencies

**Files:**
- Create: `src/index.ts`

**Step 1: Create src directory and empty entry point**

```typescript
// pattern: Functional Core
// Entry point for containerfile-ts library
// Exports will be added as features are implemented
```

**Step 2: Install dependencies**

Run: `pnpm install`
Expected: Dependencies installed, lock file created

**Step 3: Verify build works**

Run: `pnpm build`
Expected: Build succeeds, dist/ directory created with compiled output

**Step 4: Commit**

```bash
git add src/index.ts pnpm-lock.yaml
git commit -m "chore: add empty entry point and lock file"
```

---

## Task 1.5: Verify Phase 1 completion

**Step 1: Verify all scaffolding in place**

Run: `ls -la && ls -la src/ && cat package.json`
Expected: All files present

**Step 2: Verify mise tools work**

Run: `mise install && node --version && pnpm --version`
Expected: Tools installed and versions shown

**Step 3: Verify build produces output**

Run: `pnpm build && ls -la dist/`
Expected: dist/index.js and dist/index.d.ts exist
