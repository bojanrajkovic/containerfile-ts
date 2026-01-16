// pattern: Functional Core

import type {
  FromInstruction,
  RunInstruction,
  CopyInstruction,
  AddInstruction,
  WorkdirInstruction,
  EnvInstruction,
  ExposeInstruction,
  CmdInstruction,
  EntrypointInstruction,
  ArgInstruction,
  LabelInstruction,
  Containerfile,
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
} from "./types.js";

/**
 * Creates a FROM instruction
 */
export function from(image: string, options?: FromOptions): FromInstruction {
  return {
    type: "FROM",
    image,
    as: options?.as ?? null,
    platform: options?.platform ?? null,
  };
}

/**
 * Creates a RUN instruction
 */
export function run(command: string | ReadonlyArray<string>): RunInstruction {
  return {
    type: "RUN",
    command,
  };
}

/**
 * Creates a COPY instruction
 *
 * @param src - Source file path or array of source file paths
 * @param dest - Destination path in the container
 * @param options - Optional COPY options (from, chown, chmod)
 */
export function copy(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: CopyOptions,
): CopyInstruction {
  return {
    type: "COPY",
    src,
    dest,
    from: options?.from ?? null,
    chown: options?.chown ?? null,
    chmod: options?.chmod ?? null,
  };
}

/**
 * Creates an ADD instruction
 *
 * @param src - Source file path, URL, or array of source paths/URLs
 * @param dest - Destination path in the container
 * @param options - Optional ADD options (chown, chmod)
 */
export function add(
  src: string | ReadonlyArray<string>,
  dest: string,
  options?: AddOptions,
): AddInstruction {
  return {
    type: "ADD",
    src,
    dest,
    chown: options?.chown ?? null,
    chmod: options?.chmod ?? null,
  };
}

/**
 * Creates a WORKDIR instruction
 */
export function workdir(path: string): WorkdirInstruction {
  return {
    type: "WORKDIR",
    path,
  };
}

/**
 * Creates an ENV instruction
 */
export function env(key: string, value: string): EnvInstruction {
  return {
    type: "ENV",
    key,
    value,
  };
}

/**
 * Validates a port number is within the valid range (0-65535)
 */
function validatePort(port: number, label: string): void {
  if (!Number.isInteger(port)) {
    throw new Error(`invalid ${label}: ${port} (must be an integer)`);
  }
  if (port < 0 || port > 65535) {
    throw new Error(`invalid ${label}: ${port} (must be 0-65535)`);
  }
}

/**
 * Creates an EXPOSE instruction
 *
 * @param port - Port number or port range object with start and end
 * @param options - Optional EXPOSE options (protocol: tcp, udp, or sctp)
 */
export function expose(
  port: number | { readonly start: number; readonly end: number },
  options?: ExposeOptions,
): ExposeInstruction {
  if (typeof port === "number") {
    validatePort(port, "port number");
  } else {
    validatePort(port.start, "port range start");
    validatePort(port.end, "port range end");
    if (port.start > port.end) {
      throw new Error(`invalid port range: start (${port.start}) must be <= end (${port.end})`);
    }
  }
  return {
    type: "EXPOSE",
    port,
    protocol: options?.protocol ?? "tcp",
  };
}

/**
 * Creates a CMD instruction
 */
export function cmd(command: ReadonlyArray<string>): CmdInstruction {
  return {
    type: "CMD",
    command,
  };
}

/**
 * Creates an ENTRYPOINT instruction
 */
export function entrypoint(command: ReadonlyArray<string>): EntrypointInstruction {
  return {
    type: "ENTRYPOINT",
    command,
  };
}

/**
 * Creates an ARG instruction
 */
export function arg(name: string, options?: ArgOptions): ArgInstruction {
  return {
    type: "ARG",
    name,
    defaultValue: options?.defaultValue ?? null,
  };
}

/**
 * Creates a LABEL instruction
 */
export function label(key: string, value: string): LabelInstruction {
  return {
    type: "LABEL",
    key,
    value,
  };
}

/**
 * Identity function for creating a Containerfile definition
 * Provides type safety and IDE autocompletion
 */
export function containerfile(def: Containerfile): Containerfile {
  return def;
}
