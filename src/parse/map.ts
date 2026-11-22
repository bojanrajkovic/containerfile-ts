// pattern: Functional Core

import { Result, err } from "neverthrow";
import { type ValidationError, combineNonEmpty, validationError } from "../errors.js";
import { HEREDOC_REDIRECT } from "../schemas/primitives.js";
import {
  cmd,
  entrypoint,
  expose,
  from,
  run,
  shell,
  user,
  volume,
  workdir,
} from "../instructions.js";
import type { ExposeOptions, Instruction, NonEmptyArray } from "../types.js";
import { parseJsonStringArray, splitFlags, splitWords } from "./words.js";

type Mapped = Result<NonEmptyArray<Instruction>, Array<ValidationError>>;

/** The text after an instruction's keyword. See `SourceEntry`. */
export type Args = { readonly raw: string; readonly joined: string };

const PORT = /^(\d+)(?:-(\d+))?(?:\/(tcp|udp|sctp))?$/i;

function one<T extends Instruction>(result: Result<T, Array<ValidationError>>): Mapped {
  return result.map((instruction) => [instruction]);
}

function argumentsError(message: string, value: string): Mapped {
  return err([validationError("arguments", message, value)]);
}

function flagErrors(keyword: string, flags: ReadonlyArray<string>): Array<ValidationError> {
  return flags.map((flag) =>
    validationError("flag", `${keyword} ${flag.split("=")[0]} isn't supported`, flag),
  );
}

function mapFrom({ joined }: Args): Mapped {
  const { flags, rest } = splitFlags(joined);
  if (flags.length > 0) {
    return err(flagErrors("FROM", flags));
  }
  const split = splitWords(rest);
  if (!split.ok) {
    return argumentsError(split.message, joined);
  }
  const [image, keyword, name, ...extra] = split.words;
  if (image !== undefined && keyword === undefined) {
    return one(from(image));
  }
  if (
    image !== undefined &&
    keyword?.toUpperCase() === "AS" &&
    name !== undefined &&
    extra.length === 0
  ) {
    return one(from(image, { as: name }));
  }
  return argumentsError("FROM takes an image and an optional AS name", joined);
}

function mapRun({ raw, joined }: Args): Mapped {
  const { flags } = splitFlags(joined);
  const errors = [
    ...flagErrors("RUN", flags),
    ...(HEREDOC_REDIRECT.test(raw)
      ? [validationError("heredoc", "RUN heredocs aren't supported", raw)]
      : []),
  ];
  return errors.length > 0 ? err(errors) : one(run(parseJsonStringArray(joined) ?? raw));
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
    default:
      return err([validationError("instruction", `${keyword} isn't supported`, keyword)]);
  }
}
