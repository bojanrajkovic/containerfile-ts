// pattern: Functional Core

/// <reference lib="esnext.temporal" />

/**
 * FROM instruction - specifies base image
 */
export type FromInstruction = {
  readonly type: "FROM";
  readonly image: string;
  readonly as: string | null;
  readonly platform: string | null;
};

/**
 * RUN instruction - executes commands
 */
export type RunInstruction = {
  readonly type: "RUN";
  readonly command: string | ReadonlyArray<string> | Heredoc;
};

/**
 * Multi-line script for RUN, rendered as a BuildKit heredoc:
 *
 * ```
 * RUN [interpreter ]<<'delimiter'
 * line...
 * delimiter
 * ```
 *
 * `heredoc()` derives `delimiter` from the script, so it never matches a script line.
 */
export type Heredoc = {
  readonly lines: NonEmptyArray<string>;
  readonly interpreter: string | null;
  readonly delimiter: string;
};

/**
 * COPY instruction - copies files from build context or other stages
 *
 * @example
 * Single source: `COPY file.txt /dest/`
 * Multiple sources: `COPY file1.txt file2.txt /dest/`
 *
 * The `src` field is always a ReadonlyArray<string>.
 * The factory function normalizes single files to arrays for consistent handling.
 * When using an array, the final element in the container must be a directory for correct semantics.
 */
export type CopyInstruction = {
  readonly type: "COPY";
  readonly src: ReadonlyArray<string>;
  readonly dest: string;
  readonly from: string | null;
  readonly chown: string | null;
  readonly chmod: string | null;
};

/**
 * ADD instruction - copies files with URL/archive support
 *
 * @example
 * Single source: `ADD file.tar.gz /app/`
 * Multiple sources: `ADD file1.txt file2.txt /app/`
 * URL source: `ADD https://example.com/file.tar.gz /app/`
 *
 * The `src` field is always a ReadonlyArray<string>.
 * The factory function normalizes single sources to arrays for consistent handling.
 * Sources can be local files or URLs. When using an array, the final destination must be a directory.
 */
export type AddInstruction = {
  readonly type: "ADD";
  readonly src: ReadonlyArray<string>;
  readonly dest: string;
  readonly chown: string | null;
  readonly chmod: string | null;
};

/**
 * WORKDIR instruction - sets working directory
 */
export type WorkdirInstruction = {
  readonly type: "WORKDIR";
  readonly path: string;
};

/**
 * ENV instruction - sets environment variables
 */
export type EnvInstruction = {
  readonly type: "ENV";
  readonly key: string;
  readonly value: QuotedValue;
};

/**
 * A value rendered in double quotes for ENV, LABEL, and ARG.
 *
 * `\\` and `"` are always escaped. With `expand: false`, `$` is escaped too, so BuildKit
 * stores `text` exactly. With `expand: true`, `$` passes through and BuildKit expands
 * `$VAR` and `${VAR}` from build args and earlier ENV values.
 */
export type QuotedValue = {
  readonly text: string;
  readonly expand: boolean;
};

/**
 * EXPOSE instruction - documents exposed ports
 *
 * Single port: `EXPOSE 8080/tcp`
 * Port range: `EXPOSE 8080-8090/tcp`
 *
 * The `protocol` field supports TCP, UDP, and SCTP protocols.
 * Examples:
 * - TCP (default): `EXPOSE 8080/tcp`
 * - UDP: `EXPOSE 5353/udp`
 * - SCTP: `EXPOSE 132/sctp`
 * - Port range with SCTP: `EXPOSE 8080-8090/sctp`
 */
export type ExposeInstruction = {
  readonly type: "EXPOSE";
  readonly port: number;
  readonly endPort: number | null;
  readonly protocol: "tcp" | "udp" | "sctp" | null;
};

/**
 * CMD instruction - default command
 */
export type CmdInstruction = {
  readonly type: "CMD";
  readonly command: string | ReadonlyArray<string>;
};

/**
 * ENTRYPOINT instruction - container entrypoint
 */
export type EntrypointInstruction = {
  readonly type: "ENTRYPOINT";
  readonly command: string | ReadonlyArray<string>;
};

/**
 * ARG instruction - build-time variable
 */
export type ArgInstruction = {
  readonly type: "ARG";
  readonly name: string;
  readonly defaultValue: QuotedValue | null;
};

/**
 * LABEL instruction - metadata
 */
export type LabelInstruction = {
  readonly type: "LABEL";
  readonly key: string;
  readonly value: QuotedValue;
};

/**
 * USER instruction - sets the user (and optionally group) for later instructions and the container
 */
export type UserInstruction = {
  readonly type: "USER";
  readonly user: string;
  readonly group: string | null;
};

/**
 * VOLUME instruction - declares mount points
 *
 * The `paths` field is always a ReadonlyArray<string>; the factory normalizes a single path.
 */
export type VolumeInstruction = {
  readonly type: "VOLUME";
  readonly paths: ReadonlyArray<string>;
};

/**
 * SHELL instruction - overrides the default shell for shell-form commands
 *
 * Docker only accepts exec (JSON array) form, so `command` is always an array.
 */
export type ShellInstruction = {
  readonly type: "SHELL";
  readonly command: ReadonlyArray<string>;
};

/**
 * HEALTHCHECK instruction - tells the runtime how to test container health
 *
 * `check: "NONE"` disables any inherited healthcheck and takes no command or options.
 * `check: "CMD"` runs `command` on a schedule; the timing fields are Go durations
 * (e.g. "30s", "1m30s") and `null` means the runtime default.
 */
export type HealthcheckInstruction =
  | { readonly type: "HEALTHCHECK"; readonly check: "NONE" }
  | {
      readonly type: "HEALTHCHECK";
      readonly check: "CMD";
      readonly command: string | ReadonlyArray<string>;
      readonly interval: string | null;
      readonly timeout: string | null;
      readonly startPeriod: string | null;
      readonly startInterval: string | null;
      readonly retries: number | null;
    };

/**
 * An array with at least one element.
 */
export type NonEmptyArray<T> = readonly [T, ...Array<T>];

/**
 * Full-line comment. Each entry in `lines` renders as `# line`; an empty entry renders as `#`.
 *
 * A comment at the very top of a Dockerfile in `key=value` form (for example
 * `syntax=docker/dockerfile:1`) is read by BuildKit as a parser directive.
 */
export type CommentInstruction = {
  readonly type: "COMMENT";
  readonly lines: NonEmptyArray<string>;
};

/**
 * Discriminated union of all Dockerfile instructions
 */
export type Instruction =
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

/**
 * Related instructions, rendered with a blank line on each side and an optional comment
 * directly above them. Groups hold instructions only, so they can't nest.
 */
export type Group = {
  readonly type: "GROUP";
  readonly comment: CommentInstruction | null;
  readonly instructions: NonEmptyArray<Instruction>;
};

/**
 * A named stage in a multi-stage build
 */
export type Stage = {
  readonly name: string;
  readonly instructions: NonEmptyArray<Instruction | Group>;
};

/**
 * A Containerfile definition - either single-stage (instructions) or multi-stage (stages)
 */
export type Containerfile =
  | { readonly instructions: NonEmptyArray<Instruction | Group> }
  | { readonly stages: NonEmptyArray<Stage> };

/**
 * Options for the from() factory function
 */
export type FromOptions = {
  readonly as?: string;
  readonly platform?: string;
};

/**
 * Options for the copy() factory function
 */
export type CopyOptions = {
  readonly from?: string;
  readonly chown?: string;
  readonly chmod?: string;
};

/**
 * Options for the add() factory function
 */
export type AddOptions = {
  readonly chown?: string;
  readonly chmod?: string;
};

/**
 * Options for the healthcheck() factory function.
 * Durations must be non-negative and use only hours and smaller units (Go has no day unit).
 */
export type HealthcheckOptions = {
  readonly interval?: Temporal.Duration;
  readonly timeout?: Temporal.Duration;
  readonly startPeriod?: Temporal.Duration;
  readonly startInterval?: Temporal.Duration;
  readonly retries?: number;
};

/**
 * Options for the expose() factory function
 */
export type ExposeOptions = {
  readonly protocol?: "tcp" | "udp" | "sctp";
};

/**
 * Options for the arg() factory function
 */
/**
 * Options for env() and label(). `expand: true` lets BuildKit expand `$VAR` in the value.
 */
export type ValueOptions = {
  readonly expand?: boolean;
};

/**
 * Options for the arg() factory function. `expand` applies to `defaultValue`.
 */
export type ArgOptions = ValueOptions & {
  readonly defaultValue?: string;
};

/**
 * Options for the heredoc() factory function
 */
export type HeredocOptions = {
  readonly interpreter?: string;
};
