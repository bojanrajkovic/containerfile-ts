// pattern: Functional Core

import type { Instruction, Stage } from './types.js';

/**
 * Creates a named stage for multi-stage builds
 */
export function stage(name: string, instructions: ReadonlyArray<Instruction>): Stage {
  return {
    name,
    instructions,
  };
}
