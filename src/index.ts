// pattern: Functional Core
// Entry point for containerfile-ts library

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
  Containerfile,
  Stage,
  FromOptions,
  CopyOptions,
  AddOptions,
  ExposeOptions,
  ArgOptions,
} from './types.js';

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
} from './instructions.js';

export { stage } from './stage.js';

export { render } from './render.js';
