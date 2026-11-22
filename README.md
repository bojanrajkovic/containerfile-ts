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
| `run(command, options?)`         | RUN instruction (string or exec form)    |
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

### Mounts

`run()` takes a `mounts` option for BuildKit's `--mount` flag. Each mount has a `type`, and each type accepts only its own options:

```typescript
run("npm ci", {
  mounts: [
    { type: "cache", target: "/root/.npm", id: "npm", sharing: "locked" },
    { type: "secret", id: "npmrc", target: "/root/.npmrc", required: true },
  ],
});
```

```dockerfile
RUN --mount=type=cache,target=/root/.npm,id=npm,sharing=locked --mount=type=secret,id=npmrc,target=/root/.npmrc,required npm ci
```

| `type`   | Options                                                                             |
| -------- | ----------------------------------------------------------------------------------- |
| `bind`   | `target`, `source`, `from`, `readwrite`                                             |
| `cache`  | `target`, `id`, `sharing`, `from`, `source`, `mode`, `uid`, `gid`, `readonly`       |
| `tmpfs`  | `target`, `size`                                                                    |
| `secret` | `id`, `target`, `env`, `required`, `mode`, `uid`, `gid` (`id` or `target` required) |
| `ssh`    | `id`, `target`, `required`, `mode`, `uid`, `gid`                                    |

`target` is required for `bind`, `cache`, and `tmpfs`. `mode` is a number such as `0o755` and renders as four octal digits. Bind mounts are read-only unless `readwrite` is set. `sharing` is `shared`, `private`, or `locked`. `size` is a byte count with an optional unit, such as `64m`.

A mount renders as one comma-separated flag, so paths and ids can't contain a comma, a quote, a backslash, or whitespace. `$VAR` in a path or id expands at build time. Mounts work with every form of `run()`, including `chain()` and `heredoc()`, and need BuildKit.

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

Keys can't contain whitespace, `=`, quotes, `\`, or `$`, and can't start with `--`, which BuildKit reads as a flag.

### Line breaks

Each value must fit on its rendered line. A line break would start a new instruction, and a trailing single `\` (even with spaces after it) would pull the next instruction into this one, so factories reject both. A doubled `\\` is a literal backslash and is allowed.

Shell-form commands (`run`, `cmd`, `entrypoint`, `healthcheck` with a string) can span lines with `\` continuations. Every line except the last must end with `\`, and the last line must be a command. Heredoc redirects such as `cat <<EOF` are rejected, because BuildKit would read the following Dockerfile lines as the heredoc body:

```typescript
run("apt-get update && \\\n    apt-get install -y curl");
```

Exec-form array elements can contain line breaks, because JSON form renders them as `\n`.

### Parsing

`parse()` reads Dockerfile text into the same `Containerfile` the factories build, so you can inspect it or render it back:

```typescript
import { parse, render } from "@bojanrajkovic/containerfile-ts";

parse(`
FROM node:20-alpine
WORKDIR /app
RUN npm ci
CMD ["node", "index.js"]
`).match(
  (containerfile) => console.log(render(containerfile)),
  (errors) => errors.forEach((e) => console.error(`line ${e.line}: ${e.message}`)),
);
```

`parse()` returns `Result<Containerfile, ParseError[]>`. A `ParseError` is a `ValidationError` with the 1-based `line` of the instruction that caused it. Errors are collected, so one call reports every problem:

```typescript
parse("FROM node:20\nCOPY --link . /app\nEXPOSE 99999");
// [
//   { line: 2, field: "flag", message: "COPY --link isn't supported", value: "--link" },
//   { line: 3, field: "port", message: "invalid port: must be integer 0-65535", value: 99999 },
// ]
```

The output of `render(parse(text))` is a normal form of the same Dockerfile: upper-case keywords, one space between words, and `\r\n` read as `\n`. A `FROM` starts each stage, and a stage with two or more blank-line blocks becomes one group per block. A stage is named by its `AS` value, or `stage-<index>` counting from 0.

Input the model can't represent is an error, never dropped silently. `parse()` reads `FROM`, `RUN`, `CMD`, `ENTRYPOINT`, `WORKDIR`, `USER`, `VOLUME`, `EXPOSE`, `SHELL`, `ENV`, `LABEL`, `ARG`, `COPY`, `ADD`, `HEALTHCHECK`, and comments. These return an error:

- Any other instruction, such as `ONBUILD` or `STOPSIGNAL`.
- A flag the instruction doesn't take, a repeated flag, or a flag written with a space (`--chown app:app`). The flags read are `FROM --platform`, `COPY --from --chown --chmod`, `ADD --chown --chmod`, `RUN --mount` (which can repeat), and the five `HEALTHCHECK` flags. Values can't contain quotes or a backslash.
- A `--mount` the model can't hold: an unknown type or key, a key the type doesn't take (`size` on a cache mount), a missing `target` on a bind, cache, or tmpfs mount, or a path or id with a comma or whitespace.
- A `RUN` heredoc that isn't one quoted delimiter. See Heredocs.
- A `COPY` or `ADD` path with whitespace, since `render()` writes paths unquoted.
- A `# escape=` directive that isn't a backslash.

Shell-form `RUN` keeps its text as written, `\` continuations included. `parse()` never turns `&&` into a `chain()`. `CMD`, `ENTRYPOINT`, and `RUN` are exec form only when the text is a JSON array of strings, which is how BuildKit reads them. A comment inside a continued instruction moves to just above it. Words in `VOLUME`, `EXPOSE`, `COPY`, and `ADD` can be quoted with `'` or `"`.

#### Mounts

Each `--mount` flag becomes one entry of `run()`'s `mounts` option, in order, and the mount factory validates it. `parse()` reads BuildKit's spellings: keys and `type` in any case, `src`, `dst`, and `destination` for `source` and `target`, a default `type` of `bind`, and `ro`, `rw`, and `required` bare or as `=true` and `=false`. It writes the canonical form, so `--mount=src=.,dst=/s,rw` comes back as `--mount=type=bind,source=.,target=/s,rw`.

#### Heredocs

A `RUN` heredoc is read when it has one quoted delimiter, `<<'EOF'` or `<<"EOF"`, an optional interpreter before it, and the delimiter alone on the last line. The body keeps its blank lines, `#` lines, and backslashes exactly. BuildKit accepts the forms below, but the model has no field for them, so each is an error:

- An unquoted `<<EOF`. BuildKit expands `$VAR` in an unquoted body before the script runs. Quote the delimiter instead: the shell then reads the same `ARG` and `ENV` values from the environment when the script runs.
- `<<-EOF`, which strips leading tabs. Remove the tabs and use `<<'EOF'`.
- More than one heredoc on a line. Use one `RUN` for each.
- Text after the delimiter, such as `| sort` or `> /file`. Put it in the script, or use an interpreter that does it.
- A heredoc on `COPY` or `ADD`. Create the file with a `RUN` heredoc.
- An empty body. `heredoc()` needs at least one line.

A heredoc with no terminating line is an error too, and BuildKit rejects it as well.

Some input comes back in a different but equivalent form:

- A heredoc gets a new delimiter derived from its body, and `<<"EOF"` is written with single quotes.

- `EXPOSE 80 443` becomes one instruction per port. `ENV`, `LABEL`, and `ARG` with several pairs become one instruction per pair. `ENV A=1 B=$A` is an error, because a later pair in one `ENV` doesn't see an earlier one, and separate instructions would.
- `ENV` and `LABEL` accept the old form, `ENV name value`, and write it as `name="value"`.
- A value that uses a variable (`$VAR`, `${VAR}`) gets `expand: true`. A `$` that is escaped, in single quotes, or before a quote or backslash is text. A value that mixes the two, or has a quote or escape right after a variable name (`$A\b`), is an error. Write `${A}` instead.
- A `HEALTHCHECK` duration comes back in Go's canonical form: `90s` becomes `1m30s`. A continued `HEALTHCHECK CMD` joins into one line.

### Editing

Containerfiles are immutable, so `edit()` builds a changed copy. It works on the result of `parse()` or `containerfile()`:

```typescript
import { parse, edit, render, expose, env, run } from "@bojanrajkovic/containerfile-ts";

const text = `
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install

FROM nginx
CMD ["nginx"]
`;

parse(text)
  .andThen((cf) =>
    edit(cf)
      .insertAfter((i) => i.type === "WORKDIR", env("NODE_ENV", "production"))
      .stage("build", (s) => s.replace((i) => i.type === "RUN", run("npm ci")))
      .append(expose(80))
      .build(),
  )
  .map(render);
```

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
ENV NODE_ENV="production"
RUN npm ci

FROM nginx
CMD ["nginx"]
EXPOSE 80
```

Each method returns a new editor. Nothing you pass in changes, and one editor can start several results. Methods take the `Result`s the factories return, so a bad `expose(99999)` shows up in `build()` instead of throwing.

| Method                          | What it does                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `append(...items)`              | Add to the end of the file, or of the last stage                               |
| `prepend(...items)`             | Add to the start of the file, or of the first stage                            |
| `insertBefore(match, ...items)` | Add above each instruction `match` accepts                                     |
| `insertAfter(match, ...items)`  | Add below each instruction `match` accepts                                     |
| `replace(match, ...items)`      | Swap each instruction `match` accepts for the items                            |
| `remove(match)`                 | Delete each instruction `match` accepts                                        |
| `stage(name, (s) => s.…)`       | Run the same methods against one stage of a multi-stage file                   |
| `build()`                       | Apply the calls in order and return `Result<Containerfile, ValidationError[]>` |

How the calls apply:

- `match` sees every instruction, including those inside groups. An insert or replace stays in the group of the instruction it matched. On a multi-stage file, a top-level `match` applies in every stage. Use `stage()` to limit it to one.
- `append` and `prepend` add ungrouped instructions. After a group, they render as their own block with a blank line before it. They can also take a `group()`. `prepend` puts instructions above `FROM`, which is only valid for `ARG`.
- A `match` that finds nothing is an error, as is `remove` leaving a group, stage, or the file empty. `stage()` is an error on a single-stage file or for an unknown name. If several stages share a name, it edits the first.
- `build()` collects every error. A failed call changes nothing, and later calls still run. Error fields name the call: `edits[1].append[0].port` is the `port` of the first argument of the second call, and `edits[0].edits[1].remove` is the second call inside the first `stage()`.

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
