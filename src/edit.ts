// pattern: Functional Core

import { Result, ok, err } from "neverthrow";
import type { Containerfile, Group, Instruction, NonEmptyArray } from "./types.js";
import { type ValidationError, combineNonEmpty, prefixErrors, validationError } from "./errors.js";
import { containerfile } from "./instructions.js";
import { stage } from "./stage.js";
import { group } from "./group.js";

type Errors = Array<ValidationError>;
type Entry = Instruction | Group;
type Items<T> = NonEmptyArray<Result<T, Errors>>;

/** Picks the instructions an edit applies to. It sees instructions inside groups too. */
export type EditPredicate = (instruction: Instruction) => boolean;

// An interface, so each editor can pass itself as `Self`: a type alias can't refer to itself
// through a generic type alias.
interface Editor<Self> {
  /** Add to the end of the file, or of the last stage. */
  readonly append: (...items: Items<Entry>) => Self;
  /** Add to the start of the file, or of the first stage. */
  readonly prepend: (...items: Items<Entry>) => Self;
  readonly insertBefore: (match: EditPredicate, ...items: Items<Instruction>) => Self;
  readonly insertAfter: (match: EditPredicate, ...items: Items<Instruction>) => Self;
  readonly replace: (match: EditPredicate, ...items: Items<Instruction>) => Self;
  readonly remove: (match: EditPredicate) => Self;
}

/** The editor `ContainerfileEditor.stage()` hands to its callback. */
export type StageEditor = Editor<StageEditor>;

export type ContainerfileEditor = Editor<ContainerfileEditor> & {
  /** Edit one stage of a multi-stage file. The callback gets an editor scoped to it. */
  readonly stage: (
    name: string,
    edits: (editor: StageEditor) => StageEditor,
  ) => ContainerfileEditor;
  readonly build: () => Result<Containerfile, Errors>;
};

type Edit =
  | { readonly kind: "append" | "prepend"; readonly items: Items<Entry> }
  | {
      readonly kind: "insertBefore" | "insertAfter" | "replace";
      readonly match: EditPredicate;
      readonly items: Items<Instruction>;
    }
  | { readonly kind: "remove"; readonly match: EditPredicate }
  // `edits` is null when the callback returned something other than the editor it was given.
  | { readonly kind: "stage"; readonly name: string; readonly edits: ReadonlyArray<Edit> | null };

/** A single-stage file is one unit with an empty name. */
type Unit = { readonly name: string; readonly entries: NonEmptyArray<Entry> };
type Units = NonEmptyArray<Unit>;

function mapNonEmpty<T, U>(
  items: NonEmptyArray<T>,
  f: (item: T, index: number) => U,
): NonEmptyArray<U> {
  return [f(items[0], 0), ...items.slice(1).map((item, i) => f(item, i + 1))];
}

function isNonEmpty<T>(items: ReadonlyArray<T>): items is NonEmptyArray<T> {
  return items.length > 0;
}

/** Check every item Result of a call, prefixing errors with the method and argument index. */
function validateItems<T>(method: string, items: Items<T>): Result<NonEmptyArray<T>, Errors> {
  return combineNonEmpty(items, (item, i) =>
    item.mapErr((errors) => prefixErrors(`${method}[${i}]`, errors)),
  );
}

type Rewrite = {
  readonly entries: ReadonlyArray<Entry>;
  readonly matches: number;
  readonly emptiedGroup: boolean;
};

/**
 * Replace each instruction `match` accepts with `expand(instruction)`, in place: at the top
 * level or inside the group it sits in.
 */
function rewrite(
  entries: ReadonlyArray<Entry>,
  match: EditPredicate,
  expand: (instruction: Instruction) => ReadonlyArray<Instruction>,
): Rewrite {
  const results = entries.map((entry): Rewrite => {
    if (entry.type !== "GROUP") {
      return match(entry)
        ? { entries: expand(entry), matches: 1, emptiedGroup: false }
        : { entries: [entry], matches: 0, emptiedGroup: false };
    }
    const inner = entry.instructions.map((instruction) =>
      match(instruction)
        ? { instructions: expand(instruction), matches: 1 }
        : { instructions: [instruction], matches: 0 },
    );
    const instructions = inner.flatMap((r) => r.instructions);
    return {
      entries: isNonEmpty(instructions) ? [{ ...entry, instructions }] : [],
      matches: inner.reduce((sum, r) => sum + r.matches, 0),
      emptiedGroup: !isNonEmpty(instructions),
    };
  });

  return {
    entries: results.flatMap((r) => r.entries),
    matches: results.reduce((sum, r) => sum + r.matches, 0),
    emptiedGroup: results.some((r) => r.emptiedGroup),
  };
}

function emptyMessage(unit: Unit, units: Units): string {
  return units.length === 1 && unit.name === ""
    ? "would leave the containerfile empty"
    : `would leave stage ${unit.name} empty`;
}

/** insertBefore, insertAfter, replace, and remove: rewrite matches in every unit. */
function applyMatch(
  units: Units,
  field: string,
  match: EditPredicate,
  expand: (instruction: Instruction) => ReadonlyArray<Instruction>,
): Result<Units, Errors> {
  const rewrites = mapNonEmpty(units, (unit) => ({
    unit,
    ...rewrite(unit.entries, match, expand),
  }));

  if (rewrites.every((r) => r.matches === 0)) {
    return err([validationError(field, "no instruction matches", match)]);
  }

  const errors = [
    ...(rewrites.some((r) => r.emptiedGroup)
      ? [validationError(field, "would leave a group empty", match)]
      : []),
    ...rewrites
      .filter((r) => !isNonEmpty(r.entries))
      .map((r) => validationError(field, emptyMessage(r.unit, units), match)),
  ];
  const next = rewrites.flatMap((r) =>
    isNonEmpty(r.entries) ? [{ name: r.unit.name, entries: r.entries }] : [],
  );

  return errors.length > 0 || !isNonEmpty(next) ? err(errors) : ok(next);
}

function applyEdit(units: Units, change: Edit, path: string): Result<Units, Errors> {
  switch (change.kind) {
    case "append":
      return validateItems(`${path}.append`, change.items).map((items) =>
        mapNonEmpty(units, (unit, i) =>
          i === units.length - 1 ? { ...unit, entries: [...unit.entries, ...items] } : unit,
        ),
      );

    case "prepend":
      return validateItems(`${path}.prepend`, change.items).map((items) =>
        mapNonEmpty(units, (unit, i) =>
          i === 0 ? { ...unit, entries: [...items, ...unit.entries] } : unit,
        ),
      );

    case "insertBefore":
    case "insertAfter":
    case "replace": {
      const { kind, match } = change;
      return validateItems(`${path}.${kind}`, change.items).andThen((items) =>
        applyMatch(units, `${path}.${kind}`, match, (instruction) =>
          kind === "insertBefore"
            ? [...items, instruction]
            : kind === "insertAfter"
              ? [instruction, ...items]
              : items,
        ),
      );
    }

    case "remove":
      return applyMatch(units, `${path}.remove`, change.match, () => []);

    case "stage":
      return applyStage(units, change, path);
  }
}

function applyStage(
  units: Units,
  change: Extract<Edit, { kind: "stage" }>,
  path: string,
): Result<Units, Errors> {
  const field = `${path}.stage`;
  const index = units.findIndex((unit) => unit.name === change.name);
  const target = units[index];

  if (units.length === 1 && units[0].name === "") {
    return err([validationError(field, "containerfile has no stages", change.name)]);
  }
  if (target === undefined) {
    return err([validationError(field, `no stage named ${change.name}`, change.name)]);
  }
  if (change.edits === null) {
    return err([
      validationError(field, "the callback must return the editor it was given", change.name),
    ]);
  }

  const inner = applyAll([target], change.edits, `${path}.`);
  return inner.errors.length > 0
    ? err(inner.errors)
    : ok(mapNonEmpty(units, (unit, i) => (i === index ? inner.units[0] : unit)));
}

/** Apply every edit in order. A failed edit leaves the units as they were; its errors are kept. */
function applyAll(
  units: Units,
  edits: ReadonlyArray<Edit>,
  prefix: string,
): { readonly units: Units; readonly errors: Errors } {
  return edits.reduce<{ readonly units: Units; readonly errors: Errors }>(
    (state, change, i) =>
      applyEdit(state.units, change, `${prefix}edits[${i}]`).match(
        (next) => ({ units: next, errors: state.errors }),
        (errors) => ({ units: state.units, errors: [...state.errors, ...errors] }),
      ),
    { units, errors: [] },
  );
}

/** Rebuild through group(), stage(), and containerfile(), so their validation applies. */
function toContainerfile(source: Containerfile, units: Units): Result<Containerfile, Errors> {
  const results = (entries: NonEmptyArray<Entry>) =>
    mapNonEmpty(entries, (entry): Result<Entry, Errors> => {
      if (entry.type !== "GROUP") {
        return ok(entry);
      }
      const instructions = mapNonEmpty(entry.instructions, (instruction) => ok(instruction));
      return (
        entry.comment === null ? group(instructions) : group(ok(entry.comment), instructions)
      ).map((rebuilt): Entry => rebuilt);
    });

  return "instructions" in source
    ? containerfile(results(units[0].entries))
    : containerfile(mapNonEmpty(units, (unit) => stage(unit.name, results(unit.entries))));
}

function toUnits(source: Containerfile): Units {
  return "instructions" in source
    ? [{ name: "", entries: source.instructions }]
    : mapNonEmpty(source.stages, (s) => ({ name: s.name, entries: s.instructions }));
}

// The edits of each editor handed to a stage() callback, so stage() can read them back.
const stageEdits = new WeakMap<object, ReadonlyArray<Edit>>();

function methods<Self>(
  edits: ReadonlyArray<Edit>,
  next: (edits: ReadonlyArray<Edit>) => Self,
): Editor<Self> {
  const add = (edit: Edit) => next([...edits, edit]);
  return {
    append: (...items) => add({ kind: "append", items }),
    prepend: (...items) => add({ kind: "prepend", items }),
    insertBefore: (match, ...items) => add({ kind: "insertBefore", match, items }),
    insertAfter: (match, ...items) => add({ kind: "insertAfter", match, items }),
    replace: (match, ...items) => add({ kind: "replace", match, items }),
    remove: (match) => add({ kind: "remove", match }),
  };
}

function stageEditor(edits: ReadonlyArray<Edit>): StageEditor {
  const editor = methods(edits, stageEditor);
  stageEdits.set(editor, edits);
  return editor;
}

/**
 * Change a parsed or generated containerfile. Each method returns a new editor, so editors
 * and the containerfile you pass in are never modified, and one editor can start several
 * results. Methods take the `Result`s the factories return. `build()` applies the calls in
 * order, collects every error, and returns the new containerfile.
 *
 * - `append` and `prepend` add to the file, or to the last and first stage of a multi-stage
 *   file. They add ungrouped instructions, which render as their own block after a group.
 * - `insertBefore`, `insertAfter`, `replace`, and `remove` apply to every instruction the
 *   predicate accepts, in every stage, including instructions inside groups. An insert or
 *   replace stays in the group of the instruction it matched.
 * - A predicate that matches nothing is an error. So is a `remove` that would leave a group,
 *   a stage, or the file empty.
 * - `stage(name, edits)` runs the same methods against one stage, and is an error on a
 *   single-stage file or for an unknown name. If several stages share a name, it picks the
 *   first.
 *
 * Error fields name the call: `edits[1].append[0].port` is the `port` of the first argument
 * of the second call. Errors inside `stage()` continue the path: `edits[0].edits[1].remove`.
 *
 * @example
 * ```typescript
 * parse(text).andThen((cf) =>
 *   edit(cf)
 *     .append(expose(3000))
 *     .insertAfter((i) => i.type === "WORKDIR", env("NODE_ENV", "production"))
 *     .stage("build", (s) => s.replace((i) => i.type === "RUN", run("npm ci")))
 *     .build(),
 * );
 * ```
 */
export function edit(source: Containerfile): ContainerfileEditor {
  const make = (edits: ReadonlyArray<Edit>): ContainerfileEditor => ({
    ...methods(edits, make),
    stage: (name, configure) =>
      make([
        ...edits,
        { kind: "stage", name, edits: stageEdits.get(configure(stageEditor([]))) ?? null },
      ]),
    build: () => {
      const { units, errors } = applyAll(toUnits(source), edits, "");
      return errors.length > 0 ? err(errors) : toContainerfile(source, units);
    },
  });
  return make([]);
}
