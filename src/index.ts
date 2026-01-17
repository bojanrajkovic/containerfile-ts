// pattern: Functional Core

export { Result, ok, err } from "neverthrow";

export { ValidationError, validationError, prefixErrors } from "./errors.js";

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
} from "./types.js";

export type { Stage, Containerfile } from "./types.js";

export type { FromOptions, CopyOptions, AddOptions, ExposeOptions, ArgOptions } from "./types.js";

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
  containerfile,
} from "./instructions.js";

export { stage } from "./stage.js";

export { render } from "./render.js";
