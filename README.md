# containerfile-ts

[![CI](https://github.com/bojanrajkovic/containerfile-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/bojanrajkovic/containerfile-ts/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40bojanrajkovic%2Fcontainerfile-ts.svg)](https://www.npmjs.com/package/@bojanrajkovic/containerfile-ts)

Type-safe Dockerfile/Containerfile generation with declarative TypeScript, inspired by [gha-ts](https://github.com/JLarky/gha-ts).

> **Note:** This is a vibe-coded library, built quickly with AI assistance as an experiment in declarative container definitions. It works, but take it in that spirit. PRs welcome if you find rough edges!

## Installation

**Stable release (npm):**

```bash
npm install @bojanrajkovic/containerfile-ts
# or
pnpm add @bojanrajkovic/containerfile-ts
# or
yarn add @bojanrajkovic/containerfile-ts
```

**Alpha releases (GitHub Packages):**

To install pre-release versions from feature branches:

```bash
# Configure npm to use GitHub Package Registry for @bojanrajkovic scope
echo "@bojanrajkovic:registry=https://npm.pkg.github.com" >> .npmrc

# Install specific alpha version
pnpm add @bojanrajkovic/containerfile-ts@1.0.0-branch-name.1
```

**Note:** GitHub Package Registry requires authentication. See [GitHub Packages documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages) for setup.

## Usage

### Simple Dockerfile

```typescript
import { containerfile, from, workdir, copy, run, expose, cmd, render } from '@bojanrajkovic/containerfile-ts';

const dockerfile = containerfile({
  instructions: [
    from('node:20-alpine'),
    workdir('/app'),
    copy('package*.json', '.'),
    run('npm ci'),
    copy('.', '.'),
    expose(3000),
    cmd(['node', 'dist/index.js']),
  ],
});

console.log(render(dockerfile));
```

Output:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Multi-Stage Build

```typescript
import { containerfile, stage, from, workdir, copy, run, cmd, render } from '@bojanrajkovic/containerfile-ts';

const dockerfile = containerfile({
  stages: [
    stage('builder', [
      from('node:20', { as: 'builder' }),
      workdir('/app'),
      copy('package*.json', '.'),
      run('npm ci'),
      copy('.', '.'),
      run('npm run build'),
    ]),
    stage('runtime', [
      from('node:20-alpine', { as: 'runtime' }),
      workdir('/app'),
      copy('/app/dist', './dist', { from: 'builder' }),
      cmd(['node', 'dist/index.js']),
    ]),
  ],
});

console.log(render(dockerfile));
```

## API Reference

### Factory Functions

| Function | Description |
|----------|-------------|
| `from(image, options?)` | FROM instruction |
| `run(command)` | RUN instruction (string or exec form) |
| `copy(src, dest, options?)` | COPY instruction |
| `add(src, dest, options?)` | ADD instruction |
| `workdir(path)` | WORKDIR instruction |
| `env(key, value)` | ENV instruction |
| `expose(port, options?)` | EXPOSE instruction |
| `cmd(command)` | CMD instruction (exec form) |
| `entrypoint(command)` | ENTRYPOINT instruction (exec form) |
| `arg(name, options?)` | ARG instruction |
| `label(key, value)` | LABEL instruction |
| `stage(name, instructions)` | Named stage for multi-stage builds |
| `containerfile(def)` | Create containerfile definition |

### Rendering

| Function | Description |
|----------|-------------|
| `render(containerfile)` | Render to Dockerfile string |

## Options

### FromOptions

- `as?: string` - Stage name (AS clause)
- `platform?: string` - Target platform

### CopyOptions

- `from?: string` - Source stage name
- `chown?: string` - Change ownership
- `chmod?: string` - Change permissions

### AddOptions

- `chown?: string` - Change ownership
- `chmod?: string` - Change permissions

### ExposeOptions

- `protocol?: 'tcp' | 'udp' | 'sctp'` - Port protocol (default: tcp)

### ArgOptions

- `defaultValue?: string` - Default value for build arg

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history and changes.

**Note:** The changelog is automatically generated from conventional commit messages.

## License

MIT
