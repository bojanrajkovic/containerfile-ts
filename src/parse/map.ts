// pattern: Functional Core

// Must load before go-duration, which throws at import if the global Temporal is missing.
import "temporal-polyfill/global";
import { ParseDurationError, parseDuration } from "@bojanrajkovic/go-duration";
import { Result, err, ok } from "neverthrow";
import { type ValidationError, combineNonEmpty, validationError } from "../errors.js";
import { HEREDOC_REDIRECT } from "../schemas/primitives.js";
import {
  add,
  arg,
  cmd,
  copy,
  entrypoint,
  env,
  expose,
  from,
  healthcheck,
  healthcheckNone,
  label,
  run,
  shell,
  user,
  volume,
  workdir,
} from "../instructions.js";
import type { ExposeOptions, Instruction, NonEmptyArray } from "../types.js";
import { type Arg, type Pair, splitArgs, splitPairs } from "./assignments.js";
import { readFlags } from "./flags.js";
import { parseJsonStringArray, splitFlags, splitWords } from "./words.js";

type Mapped = Result<NonEmptyArray<Instruction>, Array<ValidationError>>;

/** The text after an instruction's keyword. See `SourceEntry`. */
export type Args = { readonly raw: string; readonly joined: string };

const PORT = /^(\d+)(?:-(\d+))?(?:\/(tcp|udp|sctp))?$/i;

function one(result: Result<Instruction, Array<ValidationError>>): Mapped {
  return result.map((instruction) => [instruction]);
}

function argumentsError(message: string, value: string): Mapped {
  return err([validationError("arguments", message, value)]);
}

function heredocError(keyword: string, raw: string): Mapped {
  return err([validationError("heredoc", `${keyword} heredocs aren't supported`, raw)]);
}

function mapFrom({ joined }: Args): Mapped {
  const { flags, rest } = splitFlags(joined);
  return readFlags("FROM", flags, ["--platform"]).andThen((values) => {
    const split = splitWords(rest);
    if (!split.ok) {
      return argumentsError(split.message, joined);
    }
    const [image, keyword, name, ...extra] = split.words;
    const platform = values["--platform"];
    if (image !== undefined && keyword === undefined) {
      return one(from(image, { platform }));
    }
    if (
      image !== undefined &&
      keyword?.toUpperCase() === "AS" &&
      name !== undefined &&
      extra.length === 0
    ) {
      return one(from(image, { as: name, platform }));
    }
    return argumentsError("FROM takes an image and an optional AS name", joined);
  });
}

function mapRun({ raw, joined }: Args): Mapped {
  const { flags } = splitFlags(joined);
  return readFlags("RUN", flags, []).andThen(() =>
    HEREDOC_REDIRECT.test(raw)
      ? heredocError("RUN", raw)
      : one(run(parseJsonStringArray(joined) ?? raw)),
  );
}

function mapCommand(
  factory: (command: string | ReadonlyArray<string>) => Result<Instruction, Array<ValidationError>>,
  { raw, joined }: Args,
): Mapped {
  return one(factory(parseJsonStringArray(joined) ?? raw));
}

function mapUser({ joined }: Args): Mapped {
  const split = splitWords(joined);
  if (!split.ok) {
    return argumentsError(split.message, joined);
  }
  const [word, ...extra] = split.words;
  if (word === undefined || extra.length > 0) {
    return argumentsError("USER takes one argument: user or user:group", joined);
  }
  const colon = word.indexOf(":");
  return one(colon === -1 ? user(word) : user(word.slice(0, colon), word.slice(colon + 1)));
}

function mapVolume({ joined }: Args): Mapped {
  const json = parseJsonStringArray(joined);
  if (json !== null) {
    return one(volume(json));
  }
  const split = splitWords(joined);
  return split.ok ? one(volume(split.words)) : argumentsError(split.message, joined);
}

/** The protocol in `80/UDP`, which the PORT pattern has already limited to tcp, udp, or sctp. */
function exposeOptions(protocol: string | undefined): ExposeOptions {
  const lower = protocol?.toLowerCase();
  const found = (["tcp", "udp", "sctp"] as const).find((candidate) => candidate === lower);
  return found === undefined ? {} : { protocol: found };
}

function mapExpose({ joined }: Args): Mapped {
  const split = splitWords(joined);
  if (!split.ok) {
    return argumentsError(split.message, joined);
  }
  const [first, ...rest] = split.words;
  if (first === undefined) {
    return err([validationError("ports", "EXPOSE takes at least one port", joined)]);
  }
  return combineNonEmpty([first, ...rest], (word) => {
    const match = PORT.exec(word);
    if (match === null) {
      return err([
        validationError(
          "ports",
          "must be a port or port range, such as 80, 8000-8010, or 53/udp",
          word,
        ),
      ]);
    }
    const [, start, end, protocol] = match;
    return expose(
      end === undefined ? Number(start) : { start: Number(start), end: Number(end) },
      exposeOptions(protocol),
    );
  });
}

function mapCopy(keyword: "COPY" | "ADD", { raw, joined }: Args): Mapped {
  if (HEREDOC_REDIRECT.test(raw)) {
    return heredocError(keyword, raw);
  }
  const { flags, rest } = splitFlags(joined);
  const allowed = keyword === "COPY" ? ["--from", "--chown", "--chmod"] : ["--chown", "--chmod"];
  return readFlags(keyword, flags, allowed).andThen((values) => {
    const json = parseJsonStringArray(rest);
    const split = json === null ? splitWords(rest) : { ok: true as const, words: json };
    if (!split.ok) {
      return argumentsError(split.message, joined);
    }
    const sources = split.words.slice(0, -1);
    const dest = split.words.at(-1);
    if (dest === undefined || sources.length === 0) {
      return argumentsError(`${keyword} takes at least one source and a destination`, joined);
    }
    // render() writes paths unquoted, so one with whitespace would read back as several.
    if (split.words.some((word) => /\s/.test(word))) {
      return argumentsError(`${keyword} paths with whitespace aren't supported`, joined);
    }
    const options = { chown: values["--chown"], chmod: values["--chmod"] };
    return one(
      keyword === "COPY"
        ? copy(sources, dest, { ...options, from: values["--from"] })
        : add(sources, dest, options),
    );
  });
}

/**
 * ENV and LABEL pairs, one instruction each. An ENV instruction expands its values before any
 * of its pairs is set, so splitting `ENV A=1 B=$A` would let `B` see `A`.
 */
function mapPairs(keyword: "ENV" | "LABEL", { joined }: Args): Mapped {
  const split = splitPairs(keyword, joined);
  if (!split.ok) {
    return argumentsError(split.message, joined);
  }
  const [first, ...rest] = split.value;
  if (first === undefined) {
    return argumentsError(`${keyword} takes name=value pairs`, joined);
  }
  if (keyword === "ENV" && rest.length > 0 && split.value.some((pair) => pair.value.expand)) {
    return argumentsError(
      "ENV with several pairs can't use a variable: as separate ENV instructions, a later pair would see the new value of an earlier one",
      joined,
    );
  }
  const make = keyword === "ENV" ? env : label;
  return combineNonEmpty<Pair, Instruction>([first, ...rest], ({ name, value }) =>
    make(name, value.text, { expand: value.expand }),
  );
}

function mapArg({ joined }: Args): Mapped {
  const split = splitArgs(joined);
  if (!split.ok) {
    return argumentsError(split.message, joined);
  }
  const [first, ...rest] = split.value;
  if (first === undefined) {
    return argumentsError("ARG takes names, with optional =default values", joined);
  }
  return combineNonEmpty<Arg, Instruction>([first, ...rest], ({ name, value }) =>
    value === null ? arg(name) : arg(name, { defaultValue: value.text, expand: value.expand }),
  );
}

function durationFlag(
  values: Record<string, string>,
  name: string,
): Result<Temporal.Duration | undefined, Array<ValidationError>> {
  const value = values[name];
  if (value === undefined) {
    return ok(undefined);
  }
  try {
    return ok(parseDuration(value));
  } catch (error) {
    const reason = error instanceof ParseDurationError ? error.message : "isn't a duration";
    return err([validationError("flag", `${name} ${reason}`, `${name}=${value}`)]);
  }
}

function retriesFlag(
  values: Record<string, string>,
): Result<number | undefined, Array<ValidationError>> {
  const value = values["--retries"];
  if (value === undefined) {
    return ok(undefined);
  }
  return /^\d+$/.test(value)
    ? ok(Number(value))
    : err([validationError("flag", "--retries must be a whole number", `--retries=${value}`)]);
}

function mapHealthcheck({ joined }: Args): Mapped {
  const { flags, rest } = splitFlags(joined);
  const [, word, after] = /^(\S+)\s*([\s\S]*)$/.exec(rest) ?? [];
  const check = word?.toUpperCase();

  if (check === "NONE") {
    return flags.length > 0 || after !== ""
      ? argumentsError("HEALTHCHECK NONE takes no flags or command", joined)
      : one(healthcheckNone());
  }
  if (check !== "CMD") {
    return argumentsError("HEALTHCHECK takes NONE, or CMD with a command", joined);
  }

  const command = after ?? "";
  return readFlags("HEALTHCHECK", flags, [
    "--interval",
    "--timeout",
    "--start-period",
    "--start-interval",
    "--retries",
  ]).andThen((values) =>
    Result.combineWithAllErrors([
      durationFlag(values, "--interval"),
      durationFlag(values, "--timeout"),
      durationFlag(values, "--start-period"),
      durationFlag(values, "--start-interval"),
      retriesFlag(values),
    ])
      .mapErr((errors) => errors.flat())
      .andThen(([interval, timeout, startPeriod, startInterval, retries]) =>
        one(
          healthcheck(parseJsonStringArray(command) ?? command, {
            interval,
            timeout,
            startPeriod,
            startInterval,
            retries,
          }),
        ),
      ),
  );
}

function mapShell({ joined }: Args): Mapped {
  const json = parseJsonStringArray(joined);
  return json === null
    ? err([validationError("command", "SHELL takes a JSON array of strings", joined)])
    : one(shell(json));
}

/**
 * Build the instructions one Dockerfile instruction stands for: usually one, one per port
 * for EXPOSE. Input the model can't hold, such as a flag, a heredoc, or an instruction it
 * has no type for, is an error.
 *
 * @param keyword - Upper case instruction keyword
 */
export function mapInstruction(keyword: string, args: Args): Mapped {
  switch (keyword) {
    case "FROM":
      return mapFrom(args);
    case "RUN":
      return mapRun(args);
    case "CMD":
      return mapCommand(cmd, args);
    case "ENTRYPOINT":
      return mapCommand(entrypoint, args);
    case "WORKDIR":
      return one(workdir(args.joined));
    case "USER":
      return mapUser(args);
    case "VOLUME":
      return mapVolume(args);
    case "EXPOSE":
      return mapExpose(args);
    case "SHELL":
      return mapShell(args);
    case "ENV":
    case "LABEL":
      return mapPairs(keyword, args);
    case "ARG":
      return mapArg(args);
    case "COPY":
    case "ADD":
      return mapCopy(keyword, args);
    case "HEALTHCHECK":
      return mapHealthcheck(args);
    default:
      return err([validationError("instruction", `${keyword} isn't supported`, keyword)]);
  }
}
