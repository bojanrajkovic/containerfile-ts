// pattern: Functional Core

export type { Result } from "neverthrow";

export type { ValidationError } from "./errors.js";

export type { Port, ImageName, DockerPath, PortRange } from "./schemas/index.js";

export type {
  Instruction,
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
} from "./types.js";

export type { Stage, Containerfile } from "./types.js";

export type {
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
  HealthcheckOptions,
} from "./types.js";

export {
  from,
  run,
  copy,
  add,
  workdir,
  env,
  expose,
  cmd,
  entrypoint,
  arg,
  label,
  user,
  volume,
  shell,
  healthcheck,
  healthcheckNone,
  comment,
  containerfile,
} from "./instructions.js";

export { stage } from "./stage.js";

export { render } from "./render.js";
