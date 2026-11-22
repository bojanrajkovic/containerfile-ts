// pattern: Functional Core

import { Result, err, ok } from "neverthrow";
import { type ValidationError, validationError } from "../errors.js";
import type { MountOptions, SharingMode } from "../types.js";

type Errors = Array<ValidationError>;

const MOUNT_TYPES = ["bind", "cache", "tmpfs", "secret", "ssh"] as const;
type MountType = (typeof MOUNT_TYPES)[number];

const SHARING_MODES: ReadonlyArray<SharingMode> = ["shared", "private", "locked"];

// The keys each type takes, by canonical name. `ro`, `rw`, and `required` are read apart.
const KEYS: Record<MountType, ReadonlyArray<string>> = {
  bind: ["source", "target", "from"],
  cache: ["target", "id", "sharing", "from", "source", "mode", "uid", "gid"],
  tmpfs: ["target", "size"],
  secret: ["id", "target", "env", "mode", "uid", "gid"],
  ssh: ["id", "target", "mode", "uid", "gid"],
};

// Types the model needs a target for. A secret or ssh mount can do without one.
const NEEDS_TARGET: ReadonlyArray<MountType> = ["bind", "cache", "tmpfs"];

// BuildKit's alternate spellings, stored under the canonical name.
const ALIASES: Record<string, string> = { src: "source", dst: "target", destination: "target" };

const READ_ONLY = ["ro", "readonly"];
const READ_WRITE = ["rw", "readwrite"];

// What BuildKit's strconv.ParseBool accepts, in lower case.
const TRUE = ["1", "t", "true"];
const FALSE = ["0", "f", "false"];

// The numeric keys, with how each reads.
const NUMBERS = [
  { key: "uid", pattern: /^\d+$/, base: 10, what: "a whole number" },
  { key: "gid", pattern: /^\d+$/, base: 10, what: "a whole number" },
  { key: "mode", pattern: /^[0-7]+$/, base: 8, what: "octal digits, such as 0755" },
] as const;

function isMountType(value: string): value is MountType {
  return MOUNT_TYPES.some((type) => type === value);
}

function sharingMode(value: string | undefined): SharingMode | undefined {
  return SHARING_MODES.find((mode) => mode === value?.toLowerCase());
}

/**
 * Read one `--mount=` value, such as `type=cache,target=/c,id=npm`, the way BuildKit does:
 * comma-separated `key=value` fields, keys in any case, `type` defaulting to `bind`, and `ro`,
 * `rw`, and `required` allowed bare. Anything the model has no field for is an error. The
 * mount factory checks the values.
 *
 * @param value - Text after `--mount=`, with no quotes, which `readFlags` rejects
 * @returns The options `run()` takes, or the first problem found
 */
export function parseMount(value: string): Result<MountOptions, Errors> {
  const problem = (message: string): Result<never, Errors> =>
    err([validationError("flag", message, `--mount=${value}`)]);

  const seen = new Set<string>();
  const values = new Map<string, string>();
  let readOnly: boolean | null = null;
  let access: string | null = null;
  let required: boolean | null = null;

  for (const field of value.split(",")) {
    if (field === "") {
      return problem("--mount has an empty field");
    }
    const equals = field.indexOf("=");
    const spelled = (equals === -1 ? field : field.slice(0, equals)).toLowerCase();
    const text = equals === -1 ? null : field.slice(equals + 1);
    const key = ALIASES[spelled] ?? spelled;

    const isAccess = READ_ONLY.includes(key) || READ_WRITE.includes(key);
    const group = isAccess ? "ro/rw" : key;
    if (seen.has(group)) {
      return problem(`--mount ${spelled} is given more than once`);
    }
    seen.add(group);

    if (isAccess || key === "required") {
      const lower = text?.toLowerCase() ?? "true";
      if (!TRUE.includes(lower) && !FALSE.includes(lower)) {
        return problem(`--mount ${spelled} must be true or false`);
      }
      if (key === "required") {
        required = TRUE.includes(lower);
      } else {
        readOnly = TRUE.includes(lower) === READ_ONLY.includes(key);
        access = spelled;
      }
    } else if (text === null) {
      return problem(`--mount field ${spelled} must be written ${spelled}=value`);
    } else {
      values.set(key, text);
    }
  }

  const typeText = (values.get("type") ?? "bind").toLowerCase();
  if (!isMountType(typeText)) {
    return problem(
      `--mount type ${typeText} isn't supported: use bind, cache, tmpfs, secret, or ssh`,
    );
  }
  const type = typeText;
  values.delete("type");

  for (const key of values.keys()) {
    if (!KEYS[type].includes(key)) {
      return problem(
        MOUNT_TYPES.some((other) => KEYS[other].includes(key))
          ? `--mount ${key} isn't supported on ${type} mounts`
          : `--mount ${key} isn't a mount field`,
      );
    }
  }
  if (access !== null && type !== "bind" && type !== "cache") {
    return problem(`--mount ${access} isn't supported on ${type} mounts`);
  }
  if (required !== null && type !== "secret" && type !== "ssh") {
    return problem(`--mount required isn't supported on ${type} mounts`);
  }

  const numbers: Record<string, number | undefined> = {};
  for (const { key, pattern, base, what } of NUMBERS) {
    const text = values.get(key);
    if (text !== undefined && !pattern.test(text)) {
      return problem(`--mount ${key} must be ${what}`);
    }
    numbers[key] = text === undefined ? undefined : Number.parseInt(text, base);
  }

  const sharing = values.get("sharing");
  if (sharing !== undefined && sharingMode(sharing) === undefined) {
    return problem(`--mount sharing ${sharing} isn't one of ${SHARING_MODES.join(", ")}`);
  }

  const target = values.get("target");
  if (NEEDS_TARGET.includes(type) && target === undefined) {
    return problem(`--mount ${type} needs a target`);
  }

  const owner = { mode: numbers["mode"], uid: numbers["uid"], gid: numbers["gid"] };
  switch (type) {
    case "bind":
      return ok({
        type,
        target: target ?? "",
        source: values.get("source"),
        from: values.get("from"),
        readwrite: readOnly === false,
      });
    case "cache":
      return ok({
        type,
        target: target ?? "",
        id: values.get("id"),
        sharing: sharingMode(sharing),
        from: values.get("from"),
        source: values.get("source"),
        ...owner,
        readonly: readOnly === true,
      });
    case "tmpfs":
      return ok({ type, target: target ?? "", size: values.get("size") });
    case "secret":
      return ok({
        type,
        id: values.get("id"),
        target,
        env: values.get("env"),
        required: required === true,
        ...owner,
      });
    case "ssh":
      return ok({ type, id: values.get("id"), target, required: required === true, ...owner });
  }
}
