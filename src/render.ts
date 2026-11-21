// pattern: Functional Core

import type {
  Instruction,
  Containerfile,
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
  UserInstruction,
  VolumeInstruction,
  ShellInstruction,
  HealthcheckInstruction,
  CommentInstruction,
  Group,
  QuotedValue,
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
  const { command } = instruction;
  if (typeof command === "string") {
    return `RUN ${command}`;
  }
  if ("steps" in command) {
    return `RUN ${command.steps.join(" \\\n    && ")}`;
  }
  if (!("delimiter" in command)) {
    return `RUN ${formatArray(command)}`;
  }
  const interpreter = command.interpreter === null ? "" : `${command.interpreter} `;
  // Quoted, so the shell passes the script through without expansion or `\` handling.
  return [`RUN ${interpreter}<<'${command.delimiter}'`, ...command.lines, command.delimiter].join(
    "\n",
  );
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
  const srcStr = instruction.src.join(" ");
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
  const srcStr = instruction.src.join(" ");
  line += ` ${srcStr} ${instruction.dest}`;
  return line;
}

function renderWorkdir(instruction: WorkdirInstruction): string {
  return `WORKDIR ${instruction.path}`;
}

/**
 * Double-quote a value. Escaping `\\` and `"` keeps it one argument; escaping `$` as well
 * (unless `expand`) stops BuildKit from expanding variables in it.
 */
function quote(value: QuotedValue): string {
  return `"${value.text.replace(value.expand ? /["\\]/g : /["\\$]/g, "\\$&")}"`;
}

function renderEnv(instruction: EnvInstruction): string {
  return `ENV ${instruction.key}=${quote(instruction.value)}`;
}

function renderExpose(instruction: ExposeInstruction): string {
  const protocolSuffix =
    instruction.protocol === null || instruction.protocol === "tcp"
      ? ""
      : `/${instruction.protocol}`;
  const portStr =
    instruction.endPort !== null
      ? `${instruction.port}-${instruction.endPort}`
      : String(instruction.port);
  return `EXPOSE ${portStr}${protocolSuffix}`;
}

function renderCmd(instruction: CmdInstruction): string {
  if (typeof instruction.command === "string") {
    return `CMD ${instruction.command}`;
  }
  return `CMD ${formatArray(instruction.command)}`;
}

function renderEntrypoint(instruction: EntrypointInstruction): string {
  if (typeof instruction.command === "string") {
    return `ENTRYPOINT ${instruction.command}`;
  }
  return `ENTRYPOINT ${formatArray(instruction.command)}`;
}

function renderArg(instruction: ArgInstruction): string {
  if (instruction.defaultValue !== null) {
    return `ARG ${instruction.name}=${quote(instruction.defaultValue)}`;
  }
  return `ARG ${instruction.name}`;
}

function renderLabel(instruction: LabelInstruction): string {
  return `LABEL ${instruction.key}=${quote(instruction.value)}`;
}

function renderUser(instruction: UserInstruction): string {
  return instruction.group === null
    ? `USER ${instruction.user}`
    : `USER ${instruction.user}:${instruction.group}`;
}

// Always JSON form: it stays correct when a path contains spaces.
function renderVolume(instruction: VolumeInstruction): string {
  return `VOLUME ${formatArray(instruction.paths)}`;
}

function renderShell(instruction: ShellInstruction): string {
  return `SHELL ${formatArray(instruction.command)}`;
}

function renderHealthcheck(instruction: HealthcheckInstruction): string {
  if (instruction.check === "NONE") {
    return "HEALTHCHECK NONE";
  }

  let line = "HEALTHCHECK";
  if (instruction.interval !== null) {
    line += ` --interval=${instruction.interval}`;
  }
  if (instruction.timeout !== null) {
    line += ` --timeout=${instruction.timeout}`;
  }
  if (instruction.startPeriod !== null) {
    line += ` --start-period=${instruction.startPeriod}`;
  }
  if (instruction.startInterval !== null) {
    line += ` --start-interval=${instruction.startInterval}`;
  }
  if (instruction.retries !== null) {
    line += ` --retries=${instruction.retries}`;
  }
  const command =
    typeof instruction.command === "string"
      ? instruction.command
      : formatArray(instruction.command);
  return `${line} CMD ${command}`;
}

function renderComment(instruction: CommentInstruction): string {
  return instruction.lines.map((line) => (line === "" ? "#" : `# ${line}`)).join("\n");
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
  USER: renderUser,
  VOLUME: renderVolume,
  SHELL: renderShell,
  HEALTHCHECK: renderHealthcheck,
  COMMENT: renderComment,
};

/**
 * Renders a single instruction to its Dockerfile string representation
 */
export function renderInstruction(instruction: Instruction): string {
  const renderer = renderers[instruction.type] as (instruction: Instruction) => string;
  return renderer(instruction);
}

/**
 * Renders a list of instructions and groups. Each group is its own block, and each run of
 * ungrouped instructions is one block. Blocks are separated by one blank line, so there is
 * never a blank line at the start or end, or two in a row.
 */
function renderEntries(entries: ReadonlyArray<Instruction | Group>): string {
  const blocks: Array<Array<string>> = [];
  let loose: Array<string> | null = null;

  for (const entry of entries) {
    if (entry.type === "GROUP") {
      loose = null;
      const members =
        entry.comment === null ? entry.instructions : [entry.comment, ...entry.instructions];
      blocks.push(members.map(renderInstruction));
    } else {
      if (loose === null) {
        loose = [];
        blocks.push(loose);
      }
      loose.push(renderInstruction(entry));
    }
  }

  return blocks.map((block) => block.join("\n")).join("\n\n");
}

/**
 * Type guard for single-stage containerfile
 */
function isSingleStage(
  containerfile: Containerfile,
): containerfile is Extract<Containerfile, { readonly instructions: unknown }> {
  return "instructions" in containerfile;
}

/**
 * Renders a Containerfile to its Dockerfile string representation
 * Handles both single-stage and multi-stage builds
 */
export function render(containerfile: Containerfile): string {
  if (isSingleStage(containerfile)) {
    return renderEntries(containerfile.instructions);
  }

  return containerfile.stages.map((stage) => renderEntries(stage.instructions)).join("\n\n");
}
