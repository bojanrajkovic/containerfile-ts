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
import {
  containerfile,
  from,
  workdir,
  copy,
  run,
  expose,
  cmd,
  render,
} from "@bojanrajkovic/containerfile-ts";

const dockerfile = containerfile([
  from("node:20-alpine"),
  workdir("/app"),
  copy("package*.json", "."),
  run("npm ci"),
  copy(".", "."),
  expose(3000),
  cmd(["node", "dist/index.js"]),
]);

dockerfile.match(
  (cf) => console.log(render(cf)),
  (errors) => console.error("Invalid Dockerfile:", errors),
);
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
import {
  containerfile,
  stage,
  from,
  workdir,
  copy,
  run,
  cmd,
  render,
} from "@bojanrajkovic/containerfile-ts";

const dockerfile = containerfile([
  stage("builder", [
    from("node:20", { as: "builder" }),
    workdir("/app"),
    copy("package*.json", "."),
    run("npm ci"),
    copy(".", "."),
    run("npm run build"),
  ]),
  stage("runtime", [
    from("node:20-alpine", { as: "runtime" }),
    workdir("/app"),
    copy("/app/dist", "./dist", { from: "builder" }),
    cmd(["node", "dist/index.js"]),
  ]),
]);

dockerfile.match(
  (cf) => console.log(render(cf)),
  (errors) => console.error("Invalid Dockerfile:", errors),
);
```

## API Reference

### Factory Functions

| Function                         | Description                              |
| -------------------------------- | ---------------------------------------- |
| `from(image, options?)`          | FROM instruction                         |
| `run(command)`                   | RUN instruction (string or exec form)    |
| `copy(src, dest, options?)`      | COPY instruction                         |
| `add(src, dest, options?)`       | ADD instruction                          |
| `workdir(path)`                  | WORKDIR instruction                      |
| `env(key, value)`                | ENV instruction                          |
| `expose(port, options?)`         | EXPOSE instruction                       |
| `cmd(command)`                   | CMD instruction (exec form)              |
| `entrypoint(command)`            | ENTRYPOINT instruction (exec form)       |
| `arg(name, options?)`            | ARG instruction                          |
| `label(key, value)`              | LABEL instruction                        |
| `comment(line, ...more)`         | Full-line comment, one argument per line |
| `group([comment,] instructions)` | Instructions set off by blank lines      |
| `stage(name, instructions)`      | Named stage for multi-stage builds       |
| `containerfile(def)`             | Create containerfile definition          |

### Rendering

| Function                | Description                 |
| ----------------------- | --------------------------- |
| `render(containerfile)` | Render to Dockerfile string |

### Building lists in code

`containerfile()`, `stage()`, and `group()` take a non-empty array (`NonEmptyArray<T>`). An array literal satisfies that as written. A computed array needs a length check first, so an empty Dockerfile can't type-check:

```typescript
const steps = scripts.map((script) => run(`npm run ${script}`));
if (steps.length === 0) {
  throw new Error("no build scripts configured");
}
containerfile([from("node:20-alpine"), ...steps]);
```

### Comments

`comment()` takes one argument per line and renders each as `# line`. An empty argument renders as a bare `#`:

```typescript
comment("Install dependencies first", "", "so the layer caches.");
```

```dockerfile
# Install dependencies first
#
# so the layer caches.
```

A comment at the very top of the file in `key=value` form, such as `comment("syntax=docker/dockerfile:1")`, is read by BuildKit as a [parser directive](https://docs.docker.com/reference/dockerfile/#parser-directives). `comment()` rejects `escape=`, because the line-break checks assume the default `\` escape character. Dockerfiles have no trailing comments: a `#` after an instruction is part of its arguments.

### Groups

`group()` sets related instructions apart with a blank line on each side. Pass a `comment()` first to label the group:

```typescript
containerfile([
  from("node:20-alpine"),
  group(comment("Install dependencies"), [
    workdir("/app"),
    copy("package*.json", "."),
    run("npm ci"),
  ]),
  cmd(["node", "dist/index.js"]),
]);
```

```dockerfile
FROM node:20-alpine

# Install dependencies
WORKDIR /app
COPY package*.json .
RUN npm ci

CMD ["node", "dist/index.js"]
```

Ungrouped instructions stay on consecutive lines. A group never adds a blank line at the start or end of the file or a stage, and adjacent groups share one blank line. Groups can't nest.

### Chains

`chain()` runs shell commands in order and stops at the first failure. It renders as the usual `&&` chain, one step per line:

```typescript
run(chain(["apt-get update", "apt-get install -y curl", "rm -rf /var/lib/apt/lists/*"]));
```

```dockerfile
RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*
```

Each step is one line of shell. A step can't contain a `#` comment: the chain joins into one shell line, so the comment would swallow every later step. Chains work on every builder; heredocs need BuildKit's Dockerfile frontend 1.4 or later.

### Heredocs

`heredoc()` builds a multi-line `RUN` script. Each argument in the array is one line. An optional `interpreter` runs the script with something other than the shell:

```typescript
run(heredoc(["set -e", "npm ci", "npm run build"]));
run(heredoc(["import sys", "print(sys.version)"], { interpreter: "python3" }));
```

```dockerfile
RUN <<'EOF_8e34ced5'
set -e
npm ci
npm run build
EOF_8e34ced5
RUN python3 <<'EOF_d2c21e47'
import sys
print(sys.version)
EOF_d2c21e47
```

The script runs exactly as written. The delimiter is quoted, so the shell doesn't expand `$VAR` or process backslashes; read build args from the environment at run time. The delimiter comes from a hash of the script. The same script always gets the same delimiter, so the rendered line and BuildKit's layer cache stay stable, and no script line can end the heredoc early. Heredocs need BuildKit's Dockerfile frontend 1.4 or later.

### ENV, LABEL, and ARG values

Values render in double quotes and BuildKit stores them exactly as you pass them, including spaces, quotes, backslashes, and `$`:

```typescript
env("DB_PASS", 'hunter$2 "go"'); // ENV DB_PASS="hunter\$2 \"go\""
```

To reference a build arg or an earlier ENV value, pass `{ expand: true }`. `$` then passes through, and quotes and backslashes are still escaped:

```typescript
arg("APP_ENV", { defaultValue: "production" });
env("NODE_ENV", "${APP_ENV}", { expand: true }); // ENV NODE_ENV="${APP_ENV}"
```

Keys can't contain whitespace, `=`, quotes, `\`, or `$`.

### Line breaks

Each value must fit on its rendered line. A line break would start a new instruction, and a trailing single `\` (even with spaces after it) would pull the next instruction into this one, so factories reject both. A doubled `\\` is a literal backslash and is allowed.

Shell-form commands (`run`, `cmd`, `entrypoint`, `healthcheck` with a string) can span lines with `\` continuations. Every line except the last must end with `\`, and the last line must be a command. Heredoc redirects such as `cat <<EOF` are rejected, because BuildKit would read the following Dockerfile lines as the heredoc body:

```typescript
run("apt-get update && \\\n    apt-get install -y curl");
```

Exec-form array elements can contain line breaks, because JSON form renders them as `\n`.

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
- `expand?: boolean` - Let BuildKit expand `$VAR` in `defaultValue` (default: false)

### ValueOptions (env, label)

- `expand?: boolean` - Let BuildKit expand `$VAR` in the value (default: false)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history and changes.

**Note:** The changelog is automatically generated from conventional commit messages.

## License

MIT
