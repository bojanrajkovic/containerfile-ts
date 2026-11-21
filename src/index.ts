// pattern: Functional Core

export type { Result } from "neverthrow";

export type { ValidationError } from "./errors.js";

export type { Port, ImageName, DockerPath } from "./schemas/index.js";

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

export type {
  Chain,
  Group,
  Heredoc,
  QuotedValue,
  Stage,
  Containerfile,
  NonEmptyArray,
} from "./types.js";

export type {
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
  ValueOptions,
  HealthcheckOptions,
  HeredocOptions,
} from "./types.js";

export {
  from,
  run,
  heredoc,
  chain,
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

export { group } from "./group.js";

export { render } from "./render.js";
