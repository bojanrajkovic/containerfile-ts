// pattern: Functional Core

import type {
  Instruction,
  Containerfile,
  Stage,
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
} from "./types.js";

/**
 * Formats an array as a JSON array with proper spacing after commas
 */
function formatArray(arr: ReadonlyArray<string>): string {
  return "[" + arr.map((item) => JSON.stringify(item)).join(", ") + "]";
}

function renderFrom(instruction: FromInstruction): string {
  let line = "FROM";
  if (instruction.platform !== null) {
    line += ` --platform=${instruction.platform}`;
  }
  line += ` ${instruction.image}`;
  if (instruction.as !== null) {
    line += ` AS ${instruction.as}`;
  }
  return line;
}

function renderRun(instruction: RunInstruction): string {
  if (typeof instruction.command === "string") {
    return `RUN ${instruction.command}`;
  }
  return `RUN ${formatArray(instruction.command)}`;
}

function renderCopy(instruction: CopyInstruction): string {
  let line = "COPY";
  if (instruction.from !== null) {
    line += ` --from=${instruction.from}`;
  }
  if (instruction.chown !== null) {
    line += ` --chown=${instruction.chown}`;
  }
  if (instruction.chmod !== null) {
    line += ` --chmod=${instruction.chmod}`;
  }
  const srcStr = typeof instruction.src === "string" ? instruction.src : instruction.src.join(" ");
  line += ` ${srcStr} ${instruction.dest}`;
  return line;
}

function renderAdd(instruction: AddInstruction): string {
  let line = "ADD";
  if (instruction.chown !== null) {
    line += ` --chown=${instruction.chown}`;
  }
  if (instruction.chmod !== null) {
    line += ` --chmod=${instruction.chmod}`;
  }
  const srcStr = typeof instruction.src === "string" ? instruction.src : instruction.src.join(" ");
  line += ` ${srcStr} ${instruction.dest}`;
  return line;
}

function renderWorkdir(instruction: WorkdirInstruction): string {
  return `WORKDIR ${instruction.path}`;
}

function renderEnv(instruction: EnvInstruction): string {
  return `ENV ${instruction.key}=${instruction.value}`;
}

function renderExpose(instruction: ExposeInstruction): string {
  const protocolSuffix = instruction.protocol === "tcp" ? "" : `/${instruction.protocol}`;
  const portStr =
    typeof instruction.port === "number"
      ? String(instruction.port)
      : `${instruction.port.start}-${instruction.port.end}`;
  return `EXPOSE ${portStr}${protocolSuffix}`;
}

function renderCmd(instruction: CmdInstruction): string {
  return `CMD ${formatArray(instruction.command)}`;
}

function renderEntrypoint(instruction: EntrypointInstruction): string {
  return `ENTRYPOINT ${formatArray(instruction.command)}`;
}

function renderArg(instruction: ArgInstruction): string {
  if (instruction.defaultValue !== null) {
    return `ARG ${instruction.name}=${instruction.defaultValue}`;
  }
  return `ARG ${instruction.name}`;
}

function renderLabel(instruction: LabelInstruction): string {
  return `LABEL ${instruction.key}="${instruction.value}"`;
}

/**
 * Renderer dispatch table - maps instruction type to render function
 */
const renderers: {
  readonly [K in Instruction["type"]]: (instruction: Extract<Instruction, { type: K }>) => string;
} = {
  FROM: renderFrom,
  RUN: renderRun,
  COPY: renderCopy,
  ADD: renderAdd,
  WORKDIR: renderWorkdir,
  ENV: renderEnv,
  EXPOSE: renderExpose,
  CMD: renderCmd,
  ENTRYPOINT: renderEntrypoint,
  ARG: renderArg,
  LABEL: renderLabel,
};

/**
 * Renders a single instruction to its Dockerfile string representation
 */
export function renderInstruction(instruction: Instruction): string {
  const renderer = renderers[instruction.type] as (instruction: Instruction) => string;
  return renderer(instruction);
}

/**
 * Renders a Stage to its Dockerfile string representation
 */
function renderStage(stageToRender: Stage): string {
  return stageToRender.instructions.map(renderInstruction).join("\n");
}

/**
 * Type guard for single-stage containerfile
 */
function isSingleStage(
  containerfile: Containerfile,
): containerfile is { readonly instructions: ReadonlyArray<Instruction> } {
  return "instructions" in containerfile;
}

/**
 * Renders a Containerfile to its Dockerfile string representation
 * Handles both single-stage and multi-stage builds
 */
export function render(containerfile: Containerfile): string {
  if (isSingleStage(containerfile)) {
    return containerfile.instructions.map(renderInstruction).join("\n");
  }

  return containerfile.stages.map(renderStage).join("\n\n");
}
