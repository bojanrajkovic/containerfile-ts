// pattern: Functional Core

// ============================================================================
// Result Types (re-exported from neverthrow for convenience)
// ============================================================================

export { Result, ok, err } from "neverthrow";

// ============================================================================
// Validation Types
// ============================================================================

export { ValidationError, validationError, prefixErrors } from "./errors.js";

// ============================================================================
// Branded Types
// ============================================================================

export type { Port, ImageName, DockerPath, PortRange } from "./schemas/index.js";

// ============================================================================
// Instruction Types
// ============================================================================

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

// ============================================================================
// Containerfile Types
// ============================================================================

export type { Stage, Containerfile } from "./types.js";

// ============================================================================
// Option Types
// ============================================================================

export type { FromOptions, CopyOptions, AddOptions, ExposeOptions, ArgOptions } from "./types.js";

// ============================================================================
// Factory Functions
// ============================================================================

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

// ============================================================================
// Rendering
// ============================================================================

export { render } from "./render.js";
