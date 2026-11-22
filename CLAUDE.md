# containerfile-ts

> Freshness: 2026-01-17

Type-safe Dockerfile/Containerfile generation with declarative TypeScript.

## Quick Start

```bash
pnpm install      # Install dependencies
pnpm build        # Compile TypeScript
pnpm test         # Run tests
pnpm typecheck    # Typecheck src/ and tests/ (tsconfig.test.json)
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Run linter
pnpm lint:fix     # Run linter with auto-fix
pnpm format       # Format code
pnpm format:check # Check formatting without changes
```

## Project Structure

```
src/
  index.ts          # Public exports
  types.ts          # Instruction types (Functional Core)
  instructions.ts   # Factory functions (Functional Core)
  mounts.ts         # RUN --mount validation (Functional Core)
  stage.ts          # Stage factory (Functional Core)
  render.ts         # Dockerfile rendering (Functional Core)
  parse.ts          # parse(): Dockerfile text to Containerfile (Functional Core)
  edit.ts           # edit(): immutable editor for a Containerfile (Functional Core)
  parse/            # Parser internals: source, words, flags, assignments, map, structure (Functional Core)
  errors.ts         # ValidationError and ParseError types and helpers (Functional Core)
  schemas/          # TypeBox validation schemas
    index.ts        # Schema exports
    primitives.ts   # Branded types and validators (Port, ImageName, etc.)
tests/
  fixtures/             # Expected Dockerfiles + generators
  generation.test.ts    # Fixture-based rendering tests
  instructions.test.ts  # Instruction factory unit tests
  instructions.property.test.ts  # Property-based tests for factories
  schemas/              # Schema validation tests
    primitives.test.ts  # Unit tests for primitive validators
    primitives.property.test.ts  # Property-based tests for validators
scripts/
  generate-changeset.ts  # Converts conventional commits to changesets
docs/
  design-plans/     # Design documents
  implementation-plans/  # Implementation task plans
.changeset/         # Changesets configuration and pending changesets
.github/workflows/  # CI/CD automation (see CI/CD Workflows section)
adrs/               # Architecture Decision Records
```

## Architecture

### FCIS Pattern

This project follows Functional Core, Imperative Shell:

- **Functional Core:** All src/ files are pure - types, factory functions, rendering. Currently all production code is Functional Core. `heredoc()` hashes with `node:crypto`, which is deterministic, so it stays pure; it also makes the library Node-only, matching `engines.node`.
- **Imperative Shell:** Tests perform I/O (file reading, dynamic imports)

Mark all files with pattern comment: `// pattern: Functional Core` or `// pattern: Imperative Shell`

### Type System

- Use `type` over `interface` (except for class contracts)
- Use `ReadonlyArray<T>` for array parameters
- Use `null` for absent values (not `undefined`)
- Use `Array<T>` syntax (not `T[]`)
- All fields are `readonly`
- Strict TypeScript configuration

### File Structure Details

```
src/
  index.ts        # Public API exports
  types.ts        # All instruction types, Stage, option types
  instructions.ts # Factory functions for creating instructions
  mounts.ts       # validateMounts() for run()'s mounts option
  stage.ts        # Factory function for creating multi-stage stages
  group.ts        # Factory function for instruction groups
  render.ts       # Rendering functions for Dockerfile output
  edit.ts         # edit(): immutable editor; applies recorded edits to stage units, rebuilds through the factories
  parse.ts        # parse(): reads each entry, maps it, assembles the Containerfile
  parse/
    source.ts     # Splits text into comments and instructions (the only dockerfile-ast import)
    words.ts      # Quote-aware word splitting, JSON string arrays, flag detection
    flags.ts      # readFlags(): the --name=value flags an instruction accepts
    mounts.ts     # parseMount(): one --mount= value to run()'s mount options
    assignments.ts # ENV, LABEL, and ARG pairs: BuildKit's quote and $ rules
    map.ts        # One Dockerfile instruction to model instructions, through the factories
    structure.ts  # Stages from FROM, groups from blank-line blocks
  errors.ts       # ValidationError, ParseError, and helper functions
  schemas/        # TypeBox validation schemas
    index.ts      # Re-exports from primitives
    primitives.ts # Branded types, schemas, and validation functions
tests/
  parse.test.ts                   # parse(): stages, groups, comments, instructions, errors
  parse.values.test.ts            # parse(): ENV, LABEL, ARG, COPY, ADD, HEALTHCHECK, flags
  parse.run.test.ts               # parse(): RUN --mount and heredocs
  parse.fixtures.test.ts          # render(parse(expected)) equals expected for every fixture
  parse.property.test.ts          # parse(render(cf)) keeps the text and the instructions
  parse.buildkit.test.ts          # parse() compared with BuildKit's reading
  generation.test.ts              # Fixture-based generation tests
  buildkit.test.ts                # Rendered output checked with BuildKit's parser
  buildkit/                       # Go program that runs BuildKit's parser (pinned version)
  support/buildkit.ts             # parseWithBuildKit() helper and Go detection
  support/buildkit-setup.ts       # Builds the parser once before tests (globalSetup)
  edit.test.ts                    # edit(): every method, groups, stages, errors, parse round trip
  mounts.test.ts                  # run() mounts: validation and rendering
  render.test.ts                  # Blank-line placement around groups
  instructions.test.ts            # Unit tests for instruction factories
  instructions.property.test.ts   # Property-based tests for factories
  fixtures/                       # Test fixtures with generator.ts and expected.Dockerfile
  schemas/                        # Schema validation tests
    primitives.test.ts            # Unit tests for primitive validators
    primitives.property.test.ts   # Property-based tests for validators
```

### Dependencies

**Runtime dependencies:**

- `@sinclair/typebox` - JSON Schema validation with TypeScript integration, used for branded types and schema validation
- `neverthrow` - Type-safe Result types for error handling without exceptions
- `@bojanrajkovic/go-duration` - Converts `Temporal.Duration` to Go duration strings for HEALTHCHECK. It needs a global `Temporal`, which `temporal-polyfill` supplies where the runtime lacks it.
- `temporal-polyfill` - Provides the global `Temporal` (and its types). It does nothing on runtimes that already have `Temporal`.
- `dockerfile-ast` - Finds where each instruction starts and ends, for `parse()`. It's CommonJS and imported by name. Its argument values ignore quotes, and it never validates, so `parse()` reads values from the text itself and validates through the factories.

**Dev dependencies (testing):**

- `fast-check` - Property-based testing library for generating random test inputs
- `vitest` - Test runner

## Public API Contracts

### Instruction Types

Discriminated union with `type` field for exhaustive pattern matching:

```typescript
type Instruction =
  | FromInstruction
  | RunInstruction
  | CopyInstruction
  | AddInstruction
  | WorkdirInstruction
  | EnvInstruction
  | ExposeInstruction
  | CmdInstruction
  | EntrypointInstruction
  | ArgInstruction
  | LabelInstruction
  | UserInstruction
  | VolumeInstruction
  | ShellInstruction
  | HealthcheckInstruction
  | CommentInstruction;
```

All instruction types use:

- `readonly` fields for immutability
- `null` for absent optional values (not `undefined`)
- `ReadonlyArray<T>` for array fields

### Branded Types

Instruction fields that hold a validated image, port, or path use branded types, so a value of that type has passed validation:

```typescript
type Port = number & { readonly __brand: "Port" }; // Valid port 0-65535
type ImageName = string & { readonly __brand: "ImageName" }; // Docker image name
type DockerPath = string & { readonly __brand: "DockerPath" }; // Non-empty, single-line path
type PortRange = { readonly start: Port; readonly end: Port } & { readonly __brand: "PortRange" }; // start <= end
```

`FromInstruction.image` is an `ImageName`, `ExposeInstruction.ports` is a `Port` or a `PortRange`, and COPY/ADD `src` and `dest`, `WORKDIR` `path`, and `VOLUME` `paths` are `DockerPath`s. Factories are the only public way to produce them. The validators that create them (`validatePort`, `validateImageName`, `validateDockerPath`, `validatePortRange`) live in `src/schemas/primitives.ts` and aren't exported from the package.

### NonEmptyArray

`NonEmptyArray<T> = readonly [T, ...Array<T>]`. `containerfile()`, `stage()`, `group()`, and `comment()` produce and accept it, so an empty Dockerfile, stage, group, or comment can't type-check. Callers narrow computed arrays with a length check.

### Stage Type

For multi-stage builds:

```typescript
type Stage = {
  readonly name: string;
  readonly instructions: NonEmptyArray<Instruction | Group>;
};

// Instructions set off by blank lines; groups can't nest
type Group = {
  readonly type: "GROUP";
  readonly comment: CommentInstruction | null;
  readonly instructions: NonEmptyArray<Instruction>;
};
```

### Containerfile Type

Unified discriminated union supporting both single-stage and multi-stage:

```typescript
type Containerfile =
  | { readonly instructions: NonEmptyArray<Instruction | Group> } // Single-stage
  | { readonly stages: NonEmptyArray<Stage> }; // Multi-stage
```

### Factory Functions

Factory functions create instruction objects with validation. All return `Result<Instruction, ValidationError[]>`:

| Function          | Signature                                                                                                                                                         | Notes                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `from`            | `(image: string, options?: FromOptions): Result<FromInstruction, ValidationError[]>`                                                                              | `as`, `platform` options                                                                                                             |
| `run`             | `(command: string \| ReadonlyArray<string> \| Result<Heredoc \| Chain, ValidationError[]>, options?: RunOptions): Result<RunInstruction, ValidationError[]>`      | Shell or exec form; `mounts` option (see Mounts)                                                                                     |
| `heredoc`         | `(lines: NonEmptyArray<string>, options?: HeredocOptions): Result<Heredoc, ValidationError[]>`                                                                    | `interpreter` option; delimiter is `EOF_` + 8 hex chars of the script's SHA-256                                                      |
| `chain`           | `(steps: NonEmptyArray<string>): Result<Chain, ValidationError[]>`                                                                                                | One line of shell per step; no `#` comment at the start of a word                                                                    |
| `copy`            | `(src: string \| ReadonlyArray<string>, dest: string, options?: CopyOptions): Result<CopyInstruction, ValidationError[]>`                                         | `from`, `chown`, `chmod` options                                                                                                     |
| `add`             | `(src: string \| ReadonlyArray<string>, dest: string, options?: AddOptions): Result<AddInstruction, ValidationError[]>`                                           | `chown`, `chmod` options                                                                                                             |
| `workdir`         | `(path: string): Result<WorkdirInstruction, ValidationError[]>`                                                                                                   |                                                                                                                                      |
| `env`             | `(key: string, value: string, options?: ValueOptions): Result<EnvInstruction, ValidationError[]>`                                                                 | Value quoted and literal; `expand: true` lets `$VAR` through                                                                         |
| `expose`          | `(port: number \| { start: number; end: number }, options?: ExposeOptions): Result<ExposeInstruction, ValidationError[]>`                                         | Validates port range 0-65535                                                                                                         |
| `cmd`             | `(command: string \| ReadonlyArray<string>): Result<CmdInstruction, ValidationError[]>`                                                                           | Shell or exec form                                                                                                                   |
| `entrypoint`      | `(command: string \| ReadonlyArray<string>): Result<EntrypointInstruction, ValidationError[]>`                                                                    | Shell or exec form                                                                                                                   |
| `arg`             | `(name: string, options?: ArgOptions): Result<ArgInstruction, ValidationError[]>`                                                                                 | `defaultValue` quoted and literal; `expand` as for `env`                                                                             |
| `label`           | `(key: string, value: string, options?: ValueOptions): Result<LabelInstruction, ValidationError[]>`                                                               | Value quoted and literal; `expand` as for `env`                                                                                      |
| `user`            | `(user: string, group?: string): Result<UserInstruction, ValidationError[]>`                                                                                      | No whitespace or `:` in either                                                                                                       |
| `volume`          | `(paths: string \| ReadonlyArray<string>): Result<VolumeInstruction, ValidationError[]>`                                                                          | Always renders JSON form                                                                                                             |
| `shell`           | `(command: ReadonlyArray<string>): Result<ShellInstruction, ValidationError[]>`                                                                                   | Exec form only                                                                                                                       |
| `healthcheck`     | `(command: string \| ReadonlyArray<string>, options?: HealthcheckOptions): Result<HealthcheckInstruction, ValidationError[]>`                                     | `interval`, `timeout`, `startPeriod`, `startInterval` (non-negative `Temporal.Duration`, hours or smaller), `retries` (integer >= 1) |
| `healthcheckNone` | `(): Result<HealthcheckInstruction, ValidationError[]>`                                                                                                           | Renders `HEALTHCHECK NONE`                                                                                                           |
| `comment`         | `(line: string, ...more: ReadonlyArray<string>): Result<CommentInstruction, ValidationError[]>`                                                                   | One argument per line; renders `# line`, or `#` for an empty line                                                                    |
| `containerfile`   | `(items: NonEmptyArray<Result<Instruction \| Group, ValidationError[]>>): Result<Containerfile, ValidationError[]>`                                               | Single-stage                                                                                                                         |
| `containerfile`   | `(items: NonEmptyArray<Result<Stage, ValidationError[]>>): Result<Containerfile, ValidationError[]>`                                                              | Multi-stage                                                                                                                          |
| `stage`           | `(name: string, instructions: NonEmptyArray<Result<Instruction \| Group, ValidationError[]>>): Result<Stage, ValidationError[]>`                                  | Creates named stage                                                                                                                  |
| `group`           | `(instructions: NonEmptyArray<Result<Instruction, ValidationError[]>>): Result<Group, ValidationError[]>`                                                         | Errors prefixed `instructions[i]`                                                                                                    |
| `group`           | `(comment: Result<CommentInstruction, ValidationError[]>, instructions: NonEmptyArray<Result<Instruction, ValidationError[]>>): Result<Group, ValidationError[]>` | Comment errors prefixed `comment`                                                                                                    |

### Render Functions

| Function | Signature                                             | Notes                                           |
| -------- | ----------------------------------------------------- | ----------------------------------------------- |
| `render` | `(containerfile: Containerfile): string`              | Renders full Containerfile to Dockerfile string |
| `parse`  | `(text: string): Result<Containerfile, ParseError[]>` | Reads Dockerfile text; see Parsing              |
| `edit`   | `(containerfile: Containerfile): ContainerfileEditor` | Starts an immutable editor; see Editing         |

Rendering behavior:

- Single-stage: Instructions joined with newlines (no trailing newline)
- Multi-stage: Stages joined with double newlines (blank line separator)
- Groups: each group, and each run of ungrouped instructions, is a block; blocks are joined with one blank line. A group's comment renders directly above its first instruction.
- RUN with array uses exec form `["cmd", "arg"]`
- RUN with mounts renders one `--mount=type=...` flag per mount before the command, heredoc interpreter included. Fields render in a fixed order per type, `mode` as four octal digits, and `readwrite`, `readonly`, and `required` as bare `rw`, `ro`, and `required`.
- RUN with a chain renders `RUN step1 \` then `    && stepN` per later step
- RUN with a heredoc renders `RUN [interpreter ]<<'DELIM'`, the lines, then `DELIM`
- EXPOSE omits `/tcp` suffix (default protocol)
- ENV, LABEL, and ARG values render in double quotes with `\` and `"` escaped. `$` is escaped too unless the value has `expand: true` (`QuotedValue`), so BuildKit stores the value exactly.
- COMMENT renders one `# line` per entry, `#` for an empty entry
- Options rendered in order: `--platform`, `--from`, `--chown`, `--chmod`

### Parsing

`parse(text)` returns `Result<Containerfile, ParseError[]>`, where `ParseError = ValidationError & { readonly line: number }` and `line` is 1-based. It's a pure function. Errors from every instruction are collected. Factory `ValidationError`s pass through with `line` added, and the parser's own errors use the fields `instruction`, `flag`, `heredoc`, `directive`, `arguments`, `ports`, `command`, and `text`.

`render(parse(text))` is the normal form of the same Dockerfile: `parse(render(cf))` keeps every instruction and renders the same text (adjacent comments join, and stage names come from `AS`). The decision to error instead of dropping or rewriting is in `adrs/00-parser-errors-on-unrepresentable-input.md`.

- **Instructions read:** FROM, RUN, CMD, ENTRYPOINT, WORKDIR, USER, VOLUME, EXPOSE, SHELL, ENV, LABEL, ARG, COPY, ADD, HEALTHCHECK, and comments. These are errors, because the model can't hold them: any other instruction (ONBUILD, STOPSIGNAL, MAINTAINER, unknown keywords), a flag an instruction doesn't take, a `--mount` outside the model, a heredoc that isn't one quoted delimiter on a `RUN`, a `COPY` or `ADD` path with whitespace, and a `# escape=` other than `\`. A `# escape=\` line is dropped.
- **Source reading:** `parse/source.ts` is the only `dockerfile-ast` import. It uses the library for instruction start and end lines only. Where the library continues past a line ending in `\\` (BuildKit doesn't), `source.ts` parses the rest again. CRLF becomes LF first.
- **Exec form:** `JSON.parse` of the text with continuations joined decides it, and only an array of strings counts. `CMD ['a','b']` is shell form.
- **Shell form:** the text stays as written, continuations included, with comment and blank lines inside a continuation removed. A removed comment moves above its instruction. The parser never produces `chain()`.
- **Stages:** each `FROM` after the first starts a stage, and comment lines directly above it go with it. One `FROM` gives `{ instructions }`, and more give `{ stages }` named by `AS` or `stage-<index>`.
- **Groups:** a stage with two or more blank-line blocks becomes one `Group` per block with `comment: null`. One block stays plain.
- **Words:** `splitWords()` honors `'` and `"`. BuildKit splits `VOLUME` on whitespace first, so it rejects a quoted word that contains a space, and `parse()` accepts it. `COPY` and `ADD` reject any path with whitespace, because `render()` writes paths unquoted.
- **Flags:** `parse/flags.ts` `readFlags()` takes the flags before the first word (`splitFlags()`) and the names an instruction accepts: FROM `--platform`; COPY `--from --chown --chmod`; ADD `--chown --chmod`; HEALTHCHECK `--interval --timeout --start-period --start-interval --retries`; RUN `--mount`. Each flag must be `--name=value`, appear once, and have no quote or backslash in its value. Each bad flag is its own `flag` error. `--mount` may repeat, so `mapRun` reads each `--mount` flag on its own and any other flag as an error.
- **Mounts:** `parse/mounts.ts` `parseMount()` reads one `--mount=` value as BuildKit does: comma-separated fields, keys and `type` in any case, `type` defaulting to `bind`, the aliases `src`, `dst`, `destination`, and `ro`, `rw`, `required` bare or `=true`/`=false` (strconv.ParseBool spellings). It checks each key against the keys the type takes, reads `mode` as octal, and leaves value checks (paths, ids, ranges) to the mount factory, whose errors come back as `mounts[i].field`. A mount has no quotes, because `readFlags` rejects them.
- **Heredocs:** `source.ts` keeps a heredoc's body verbatim, since blank lines, `#` lines, and `\` mean nothing inside it. `mapRun` reads a start line of `[interpreter ]<<'NAME'` or `<<"NAME"`, takes the body up to a last line that is exactly `NAME`, and passes the lines to `heredoc()`, which derives the delimiter. `<<EOF`, `<<-EOF`, a second heredoc, text after the delimiter, a missing terminator, and an empty body are `heredoc` errors. COPY and ADD heredocs are errors too (`mapCopy`).
- **ENV, LABEL, ARG:** `parse/assignments.ts` reads `name=value` words and the old `ENV name value` form with BuildKit's quote rules: single quotes are literal, double quotes escape only `"`, `$`, and `\`, and a backslash outside quotes escapes the next character. `expand` is true when the value has a `$` BuildKit would expand. Several pairs split into one instruction each, except an `ENV` with an expanding value, which is an error. Values `QuotedValue` can't hold are errors: a literal `$` next to an expanding one, and a variable name followed by a quote or escape (`$A\b`). A `$` before a quote or backslash is literal, because BuildKit reads a variable name only from the characters right after the `$`.
- **HEALTHCHECK:** `NONE`, or `CMD` with flags before it. Durations go through `parseDuration()` from `@bojanrajkovic/go-duration`, so `90s` renders back as `1m30s`. A continued shell command is joined into one line.

### Editing

`edit(containerfile)` returns a `ContainerfileEditor`: `append`, `prepend`, `insertBefore`, `insertAfter`, `replace`, `remove`, `stage(name, fn)`, and `build()`. Every method but `build()` returns a new editor, so editors and the input are never modified. Methods take factory `Result`s, and `build()` returns `Result<Containerfile, ValidationError[]>`.

- Edits are plain data. `build()` applies them in order to a list of units (one per stage, or one for a single-stage file), then rebuilds through `group()`, `stage()`, and `containerfile()`, so their validation applies.
- A `match` predicate sees `Instruction`s, including those inside groups. `insertBefore`, `insertAfter`, `replace`, and `remove` apply to every match in every stage. An insert or replace stays in the matched instruction's group.
- `append` goes to the end of the last stage and `prepend` to the start of the first, as ungrouped entries. They accept `Instruction` or `Group` Results. The other methods accept `Instruction` Results.
- Errors: no match, a `remove` that empties a group, stage, or file, `stage()` on a single-stage file or with an unknown name, and a `stage()` callback that returns something other than its editor.
- A failed call changes nothing. Later calls still run and report, so one `build()` returns every error. Fields are `edits[i].<method>[argument].<field>`, and errors inside `stage()` continue the path as `edits[i].edits[j]...`.
- `StageEditor` is an interface-based type, so each editor can name itself as the return type. It's the one place the project uses `interface` for a type that isn't a class contract.

### Mounts

`RunInstruction.mounts` is a `ReadonlyArray<Mount>`, empty when there are none. `Mount` is a union discriminated on `type`, and each member holds only the fields BuildKit accepts for that type: `bind`, `cache`, `tmpfs`, `secret`, `ssh`. Absent optional fields are `null`, and the flags `readwrite` (bind), `readonly` (cache), and `required` (secret, ssh) are `false`. `run()` takes `MountOptions` and validates them with `validateMounts()`:

- `target` is required for `bind`, `cache`, and `tmpfs`. A secret needs an `id` or a `target`.
- Paths and ids can't contain a comma, a quote, a backslash, or whitespace. A mount renders as one comma-separated flag, and BuildKit's parser drops backslashes from flag values. `from` can't contain `$`, since BuildKit reads it before expanding variables.
- `uid` and `gid` are integers from 0 to 2³²−1. `mode` is permission bits from 0 to `0o7777`.
- Errors carry fields like `mounts[1].target`.

`tests/buildkit/main.go` prints BuildKit's parsed mounts, so `tests/buildkit.test.ts` checks every mount type against BuildKit's own reading.

### Error Handling

All factory functions return `Result<T, ValidationError[]>` from neverthrow. Handle results using:

```typescript
import { containerfile, from, run, render } from "@bojanrajkovic/containerfile-ts";

const result = containerfile([from("node:18"), run("npm install")]);

// Pattern matching (preferred)
result.match(
  (cf) => console.log(render(cf)),
  (errors) => console.error("Validation failed:", errors),
);

// Or use chainable methods
result.map((cf) => render(cf)).mapErr((errors) => errors.map((e) => e.message).join(", "));
```

**Important:** Never use `isOk()`/`isErr()` with manual property access. Always use `.match()` or chainable methods (`.map()`, `.mapErr()`, `.andThen()`) for type-safe Result handling.

ValidationError structure:

```typescript
type ValidationError = {
  readonly field: string; // e.g., "port", "instructions[2].src"
  readonly message: string; // Human-readable error
  readonly value: unknown; // The invalid value
};
```

### Validation

All factory functions validate inputs and return Results:

- **Port numbers**: Must be integers 0-65535
- **Port ranges**: Start must be <= end
- **Image names**: Must match Docker registry format
- **Paths**: Must be non-empty strings
- **Command arrays**: Must be non-empty with non-empty elements
- **ENV, LABEL, and ARG keys**: Non-empty, with no whitespace, `=`, quotes, `\`, or `$`, and not starting with `--` (BuildKit reads that as a flag and drops the pair).
- **Line breaks**: Values rendered as plain text reject `\r`, `\n`, and a trailing continuation: a single `\`, optionally followed by spaces or tabs, matching BuildKit's `lineContinuationRegex`. A doubled `\\` is a literal backslash, so they can't inject or join instructions. Shell-form commands allow `\` line continuations when the last line is a command, and reject heredoc redirects (`validateShellCommand`). Exec-form elements allow line breaks, since JSON form escapes them.

Errors are collected, not short-circuited. A single call may return multiple ValidationErrors.

## Testing

### Fixture-Based Testing

Integration tests verify complete Dockerfile generation:

1. Create `tests/fixtures/<name>/expected.Dockerfile`
2. Create `tests/fixtures/<name>/generator.ts` exporting `fixture`
3. Run `pnpm test` - generator output compared to expected

Tests use Vitest with a fixture-based approach:

- Each fixture has a `generator.ts` exporting a `fixture` containerfile definition
- Each fixture has an `expected.Dockerfile` with the expected rendered output
- Tests dynamically discover fixtures and verify generation matches expected output

To add a new test fixture:

1. Create `tests/fixtures/<fixture-name>/generator.ts`
2. Create `tests/fixtures/<fixture-name>/expected.Dockerfile`
3. Export `fixture` from the generator file

### Unit Tests

`tests/instructions.test.ts` - Tests each factory function for:

- Valid input returns `Ok` with correct instruction structure
- Invalid input returns `Err` with appropriate ValidationErrors
- Error messages include field names and invalid values

`tests/schemas/primitives.test.ts` - Tests primitive validators for:

- Valid values return `Ok` with branded types
- Invalid values return `Err` with ValidationErrors
- Edge cases (empty strings, boundary values, special characters)

### BuildKit Parser Tests

`tests/buildkit.test.ts` renders output and parses it with BuildKit's own parser, so tests check what BuildKit actually reads instead of a hand-written reading of its rules.

- `tests/buildkit/` is a small Go module pinned to a BuildKit release. Its `main.go` reads a Dockerfile on stdin and prints each instruction as JSON: parser args, flags, heredocs, and the typed command after variable expansion.
- `tests/support/buildkit-setup.ts` (vitest `globalSetup`) builds that program once before the tests run. `tests/support/buildkit.ts` exposes `parseWithBuildKit()` and `describeWithBuildKit`.
- Go comes from `.mise.toml`. Without Go the suite skips locally; in CI a missing Go fails the run.
- Every fixture must parse with no warnings and the instructions the model holds. Property tests feed hostile input to factories and check that anything accepted parses as one instruction with the intended value.

To bump BuildKit, run `go get github.com/moby/buildkit@<version> && go mod tidy` in `tests/buildkit`.

### Property-Based Testing

Uses fast-check to generate random inputs:

`tests/instructions.property.test.ts` - Verifies:

- All valid inputs produce Ok results (no false negatives)
- Invalid inputs consistently produce Err results (no false positives)
- Error messages always include the invalid value

`tests/schemas/primitives.property.test.ts` - Verifies:

- Port validation accepts 0-65535, rejects others
- Image name validation handles various registry formats
- String validation rejects empty strings

## Git Workflow

### Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commit messages must follow this format:

```
<type>[optional scope]: <description>

[optional body]
```

**Types (choose carefully):**

- `feat:` - New library/application features (user-facing functionality)
- `fix:` - Bug fixes to library/application code (not CI, not tooling)
- `chore:` - Cleanup, minor package tweaks, lint fixes, dependency updates
- `ci:` - CI/CD workflow changes (GitHub Actions, publishing pipelines)
- `docs:` - Documentation only changes
- `test:` - Adding or updating tests
- `refactor:` - Significant code restructuring without behavior change
- `perf:` - Performance improvements

**Type selection guidance:**

- If it changes `.github/workflows/` → use `ci:`
- If it fixes a bug users would encounter → use `fix:`
- If it adds functionality users would use → use `feat:`
- If it restructures code without changing behavior → use `refactor:`
- If it's minor cleanup or dependency bumps → use `chore:`

### Trunk-Based Development

1. Create feature branch from main
2. Make commits per logical change (using conventional commits)
3. Pre-commit hook runs `pnpm lint:fix`
4. Pre-push hook runs `pnpm typecheck && pnpm test`
5. Squash merge back to main with descriptive message

### Merge Guidelines

- **Always squash merge** feature branches to main (keeps history clean)
- **Commit messages should describe what was built**, not implementation details
- **Do not reference phase numbers** or implementation plan details in final commit messages
- Focus on the "what" and "why" for users, not the "how" of development

### Git Hooks

Husky manages git hooks:

- **commit-msg**: Validates conventional commit format via commitlint
- **pre-commit**: Runs lint-staged (`pnpm lint:fix` on staged files)
- **pre-push**: Runs `pnpm typecheck && pnpm test` to verify before push

## CI/CD Workflows

This project uses GitHub Actions for automated testing, publishing, and releases.

### Workflows

**CI Testing (`ci.yml`)**

- **Triggers:** All branches and pull requests
- **Purpose:** Quality validation before merge or publish
- **Steps:** Format check → Lint → Typecheck → Test → Build → Security audit
- **Required:** Must pass before PRs can merge (branch protection)

**Publish Switch (`publish-switch.yml`)**

- **Triggers:** CI passes on `feat/*` or `fix/*` branches, or push to main
- **Purpose:** Single OIDC entry point routing to alpha or release workflows
- **Routes to:**
  - `publish-alpha.yml` for feat/fix branches
  - `publish-release.yml` for main branch

**Alpha Publishing (`publish-alpha.yml`)**

- **Triggers:** Called by publish-switch after CI passes on `feat/*` or `fix/*` branches
- **Purpose:** Per-branch pre-release packages for testing
- **Publishes to:** npm with `@alpha` tag
- **Versioning:** Changesets snapshot: `{version}-{branch}-{sha}`
- **Example:** `@bojanrajkovic/containerfile-ts@1.0.0-add-healthcheck-abc1234`
- **Usage:** `pnpm add @bojanrajkovic/containerfile-ts@alpha`
- **PR notifications:** After successful publish, a comment is posted to the associated PR with:
  - Package version in a table format
  - Installation commands (specific version and alpha tag)
  - Commit SHA and branch info
- **Commit status:** Shows `alpha-publish` status (pending → success/failure) on PR commits

**Release Publishing (`publish-release.yml`)**

- **Triggers:** Called by publish-switch on push to main
- **Purpose:** PR-based production releases to npm
- **Uses:** Changesets with custom `generate-changeset.ts` script
- **Versioning:** `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major
- **Runs as:** the releaser bot (a GitHub App), in the `release` environment. The job mints an app token from the `RELEASER_BOT_CLIENT_ID` variable and `RELEASER_BOT_PRIVATE_KEY` secret. We use the bot instead of `GITHUB_TOKEN` because PRs and commits made with `GITHUB_TOKEN` don't trigger workflows, so the release PR would get no CI.
- **Workflow:**
  1. Generates changesets from conventional commits since last tag. Each entry is the commit subject plus any `BREAKING CHANGE` note. The commit body (the PR description) stays out of the changelog.
  2. Creates or updates the "Version Packages" PR as the bot (if releasable changes exist)
  3. On PR merge (by a maintainer, by hand): publishes to npm with `@latest` tag, and the bot creates the git tag and GitHub Release
- **Publishes to:** npm public registry as `@bojanrajkovic/containerfile-ts`

**PR Title Validation (`pr-title.yml`)**

- **Triggers:** PR opened, edited, synchronized, reopened
- **Purpose:** Enforce conventional commits on PR titles
- **Required:** Must pass before PRs can merge (branch protection)
- **Why:** Squash merge uses PR title as commit message on main

**Dependency Review (`dependency-review.yml`)**

- **Triggers:** Pull requests to main
- **Purpose:** Block vulnerable dependencies (moderate+ severity)
- **Action:** Comments on PR with security analysis

### Publishing Strategy

**Alpha packages (testing):**

- Push commits to `feat/user-auth` or `fix/validation-bug` branch
- CI runs and passes
- Alpha package published with snapshot version:
  - `@bojanrajkovic/containerfile-ts@1.0.0-user-auth-abc1234`
- Install with: `pnpm add @bojanrajkovic/containerfile-ts@alpha`

**Release packages (production):**

- Merge PR with `feat:` or `fix:` title to main
- `generate-changeset.ts` creates changesets from conventional commits
- changesets/action creates "Version Packages" PR with:
  - Version bump in package.json
  - Updated CHANGELOG.md with commit history
- Review and merge the "Version Packages" PR
- Merging triggers:
  - npm package publication: `@bojanrajkovic/containerfile-ts@x.x.x`
  - Git tag and GitHub Release creation
- Install with: `pnpm add @bojanrajkovic/containerfile-ts`

### Conventional Commits

All commits and PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:** `<type>[optional scope]: <description>`

**Types:**

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation only changes
- `chore:` - Maintenance tasks, dependencies, tooling
- `test:` - Adding or updating tests
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `perf:` - Performance improvements
- `ci:` - CI/CD configuration changes
- `revert:` - Reverts a previous commit

**Breaking Changes:**

Breaking changes trigger a major version bump. You MUST mark them explicitly for the `generate-changeset.ts` script to detect them:

- **Option 1:** Add `!` after the type: `feat!: change API to return Result types`
- **Option 2:** Include `BREAKING CHANGE:` in the commit footer:

  ```
  feat: change API to return Result types

  BREAKING CHANGE: All factory functions now return Result<T, ValidationError[]>
  instead of throwing exceptions. Callers must handle the Result type.
  ```

**Why this matters:** The `generate-changeset.ts` script parses conventional commits to determine version bumps. Without explicit breaking change markers, API-breaking changes will only trigger a minor bump instead of a major bump, violating semver.

**Enforcement:**

- Local: `commit-msg` git hook validates commit messages
- CI: PR title validation workflow validates PR titles
- Required: PR titles must be valid (becomes commit message on squash merge)

**Examples:**

- `feat: add HEALTHCHECK instruction support`
- `fix: correct EXPOSE port range validation`
- `docs: update API documentation for multi-stage builds`
- `chore: upgrade vitest to 3.0.0`
- `feat(render): add comment support in Dockerfile output`

## npm Publishing Configuration

This project publishes through npm Trusted Publishing, with provenance attestation enabled. There is no npm token: npm trusts the OIDC identity of `publish-switch.yml`, which is why both alpha and release publishing route through it.

### Required Configuration

**`release` environment (GitHub):**

- `RELEASER_BOT_CLIENT_ID` (variable) - client ID of the releaser bot GitHub App
- `RELEASER_BOT_PRIVATE_KEY` (secret) - the app's private key

The app must be installed on this repository with contents and pull requests write access.

### Provenance Attestation

Both publish workflows set `NPM_CONFIG_PROVENANCE: true` to generate provenance attestations. This provides:

- **Audit trail:** All publishes linked to specific GitHub Actions runs
- **Supply chain security:** npm verifies packages were built from this repository
- **Transparency:** Users can verify package authenticity

### Workflow Permissions

The `publish-switch.yml` workflow (OIDC entry point) passes permissions to reusable workflows:

- `id-token: write` - Required for Trusted Publishing and provenance
- `contents: read` - Release publishing; repo writes use the releaser bot token

The bot token is scoped to `contents: write` (release commits, tags, GitHub Releases) and `pull-requests: write` (the "Version Packages" PR).

### Troubleshooting

If npm publishing fails with an authentication error:

1. Verify the Trusted Publisher on npmjs.com names this repository and `publish-switch.yml`
2. Check the workflow has `id-token: write` permission
3. Check `NPM_CONFIG_PROVENANCE: true` is set in workflow

If the "Mint releaser bot token" step fails, check that the releaser bot app is installed on the repository and that the `release` environment has the variable and secret above.

## ADRs

Architecture Decision Records go in `adrs/` with sequential filenames:

- `00-use-discriminated-unions.md`
- `01-fixture-based-testing.md`

## Future Work

Track future tasks, enhancements, and bugs using [GitHub Issues](https://github.com/bojanrajkovic/containerfile-ts/issues).

**Before creating issues:** Show the user the proposed title, body, and labels for each issue and ask for feedback before creating it.

Historical context for potential future instructions is in `docs/future-instructions.md`.

## Implementation Status

- Phase 1: Project Scaffolding - Complete
- Phase 2: Core Instruction Types - Complete
- Phase 3: Factory Functions - Complete
- Phase 4: Rendering Logic - Complete
- Phase 5: Multi-Stage Support - Complete
- Phase 6: Testing Infrastructure - Complete
- Phase 7: Linting and Git Hooks - Complete
- Phase 8: Documentation - Complete
