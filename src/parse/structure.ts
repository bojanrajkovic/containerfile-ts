// pattern: Functional Core

import type {
  Containerfile,
  FromInstruction,
  Group,
  Instruction,
  NonEmptyArray,
} from "../types.js";

/** An instruction and the blank-line block it came from. */
export type Placed = { readonly block: number; readonly instruction: Instruction };

type Block = { readonly id: number; readonly items: Array<Instruction> };
type StageDraft = { readonly blocks: Array<Block> };

// Every list built below gets at least one item before this runs.
function nonEmpty<T>(items: ReadonlyArray<T>): NonEmptyArray<T> {
  const [first, ...rest] = items;
  if (first === undefined) {
    throw new Error("expected at least one item");
  }
  return [first, ...rest];
}

function add(stage: StageDraft, block: number, instruction: Instruction): void {
  const last = stage.blocks.at(-1);
  if (last !== undefined && last.id === block) {
    last.items.push(instruction);
  } else {
    stage.blocks.push({ id: block, items: [instruction] });
  }
}

/**
 * Remove the comments that end `block` in `stage` and return them. They sit directly above
 * the next FROM, so they belong to the stage it starts.
 */
function takeTrailingComments(stage: StageDraft, block: number): Array<Instruction> {
  const last = stage.blocks.at(-1);
  if (last === undefined || last.id !== block) {
    return [];
  }
  let keep = last.items.length;
  while (keep > 0 && last.items[keep - 1]?.type === "COMMENT") {
    keep--;
  }
  const taken = last.items.splice(keep);
  if (last.items.length === 0) {
    stage.blocks.pop();
  }
  return taken;
}

function entriesOf(stage: StageDraft): NonEmptyArray<Instruction | Group> {
  if (stage.blocks.length < 2) {
    return nonEmpty(stage.blocks.flatMap((block) => block.items));
  }
  return nonEmpty(
    stage.blocks.map((block): Group => ({
      type: "GROUP",
      comment: null,
      instructions: nonEmpty(block.items),
    })),
  );
}

function stageName(stage: StageDraft, index: number): string {
  const from = stage.blocks
    .flatMap((block) => block.items)
    .find((instruction): instruction is FromInstruction => instruction.type === "FROM");
  return from?.as ?? `stage-${index}`;
}

/**
 * Arrange instructions into a Containerfile. Each FROM after the first starts a stage, and
 * the first stage also holds anything before its FROM. A stage with two or more blank-line
 * blocks gets one group per block.
 */
export function assemble(items: NonEmptyArray<Placed>): Containerfile {
  const [head, ...tail] = items;
  let current: StageDraft = { blocks: [{ id: head.block, items: [head.instruction] }] };
  const stages: Array<StageDraft> = [current];
  let seenFrom = head.instruction.type === "FROM";

  for (const { block, instruction } of tail) {
    if (instruction.type === "FROM" && seenFrom) {
      const comments = takeTrailingComments(current, block);
      current = { blocks: [{ id: block, items: [...comments, instruction] }] };
      stages.push(current);
    } else {
      add(current, block, instruction);
    }
    seenFrom ||= instruction.type === "FROM";
  }

  const [only, ...others] = stages;
  return only !== undefined && others.length === 0
    ? { instructions: entriesOf(only) }
    : {
        stages: nonEmpty(
          stages.map((stage, index) => ({
            name: stageName(stage, index),
            instructions: entriesOf(stage),
          })),
        ),
      };
}
