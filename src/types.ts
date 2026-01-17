// pattern: Functional Core

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
  readonly command: string | ReadonlyArray<string>;
};

/**
 * COPY instruction - copies files from build context or other stages
 *
 * @example
 * Single source: `COPY file.txt /dest/`
 * Multiple sources: `COPY file1.txt file2.txt /dest/`
 *
 * The `src` field supports both single file (string) and multiple files (ReadonlyArray<string>).
 * When using an array, the final element in the container must be a directory for correct semantics.
 */
export type CopyInstruction = {
  readonly type: "COPY";
  readonly src: string | ReadonlyArray<string>;
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
 * The `src` field supports both single source (string) and multiple sources (ReadonlyArray<string>).
 * Sources can be local files or URLs. When using an array, the final destination must be a directory.
 */
export type AddInstruction = {
  readonly type: "ADD";
  readonly src: string | ReadonlyArray<string>;
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
  readonly value: string;
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
  readonly command: ReadonlyArray<string>;
};

/**
 * ENTRYPOINT instruction - container entrypoint
 */
export type EntrypointInstruction = {
  readonly type: "ENTRYPOINT";
  readonly command: ReadonlyArray<string>;
};

/**
 * ARG instruction - build-time variable
 */
export type ArgInstruction = {
  readonly type: "ARG";
  readonly name: string;
  readonly defaultValue: string | null;
};

/**
 * LABEL instruction - metadata
 */
export type LabelInstruction = {
  readonly type: "LABEL";
  readonly key: string;
  readonly value: string;
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
  | LabelInstruction;

/**
 * A named stage in a multi-stage build
 */
export type Stage = {
  readonly name: string;
  readonly instructions: ReadonlyArray<Instruction>;
};

/**
 * A Containerfile definition - either single-stage (instructions) or multi-stage (stages)
 */
export type Containerfile =
  | { readonly instructions: ReadonlyArray<Instruction> }
  | { readonly stages: ReadonlyArray<Stage> };

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
 * Options for the expose() factory function
 */
export type ExposeOptions = {
  readonly protocol?: "tcp" | "udp" | "sctp";
};

/**
 * Options for the arg() factory function
 */
export type ArgOptions = {
  readonly defaultValue?: string;
};
