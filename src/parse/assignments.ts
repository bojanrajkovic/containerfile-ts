// pattern: Functional Core

import type { QuotedValue } from "../types.js";

export type Pair = { readonly name: string; readonly value: QuotedValue };
export type Arg = { readonly name: string; readonly value: QuotedValue | null };

type Failure = { readonly ok: false; readonly message: string };
type Read<T> = { readonly ok: true; readonly value: T } | Failure;

const fail = (message: string): Failure => ({ ok: false, message });

/**
 * Read quotes, escapes, and `$` the way BuildKit reads a value. `expand` is true when the
 * value has a `$` that BuildKit would expand: one outside single quotes and not escaped.
 *
 * `QuotedValue` keeps the text with its quotes and escapes removed. That is only the same
 * value when no `$` changes meaning once they're gone, so these are failures:
 * - a literal `$` next to an expanding one, since `expand` is for the whole value
 * - a variable name followed by a quote or escape, such as `$A\b`, where the text `$Ab`
 *   would name a different variable
 */
function readValue(raw: string): Read<QuotedValue> {
  let text = "";
  let expands = false;
  let literalDollar = false;
  let endsName = false;
  let runsIntoName = false;

  // A quote or escape that ends a bare `$NAME` in the raw text.
  const boundary = () => {
    endsName ||= /\$\w+$/.test(text);
  };
  const emit = (chunk: string) => {
    if (chunk !== "") {
      runsIntoName ||= endsName && /^\w/.test(chunk);
      endsName = false;
      text += chunk;
    }
  };
  // A `$` before a quote or backslash is literal: BuildKit reads a variable name only from the
  // characters right after the `$`. Removing the quote or escape would put the next character
  // there and turn it into a variable.
  const unescapedDollar = (after: string) => {
    if (after === "'" || after === '"' || after === "\\") {
      literalDollar = true;
    } else {
      expands = true;
    }
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i);
    const next = raw.charAt(i + 1);

    if (ch === "'") {
      const end = raw.indexOf("'", i + 1);
      if (end === -1) {
        return fail("unterminated single quote");
      }
      const quoted = raw.slice(i + 1, end);
      literalDollar ||= quoted.includes("$");
      boundary();
      emit(quoted);
      boundary();
      i = end;
    } else if (ch === '"') {
      // Inside double quotes a backslash escapes only `"`, `$`, and `\`; any other stays.
      boundary();
      for (i++; i < raw.length && raw.charAt(i) !== '"'; i++) {
        const inner = raw.charAt(i);
        const after = raw.charAt(i + 1);
        if (inner === "\\" && (after === '"' || after === "$" || after === "\\")) {
          literalDollar ||= after === "$";
          boundary();
          emit(after);
          i++;
        } else {
          if (inner === "$") {
            unescapedDollar(after);
          }
          emit(inner);
        }
      }
      if (i >= raw.length) {
        return fail("unterminated double quote");
      }
      boundary();
    } else if (ch === "\\") {
      literalDollar ||= next === "$";
      boundary();
      emit(next);
      i++;
    } else {
      if (ch === "$") {
        unescapedDollar(next);
      }
      emit(ch);
    }
  }

  if (expands && literalDollar) {
    return fail("mixes $VAR with a literal $, which one value can't hold");
  }
  if (expands && runsIntoName) {
    return fail("has a quote or escape right after a variable name: write ${NAME} instead");
  }
  return { ok: true, value: { text, expand: expands } };
}

/** A word of the raw text, with its quotes and escapes, and where its first `=` is. */
type RawWord = { readonly raw: string; readonly equals: number };

/**
 * Split at whitespace that isn't quoted or escaped. `equals` is the first `=` outside quotes
 * and escapes, or -1.
 */
function rawWords(text: string): Read<Array<RawWord>> {
  const words: Array<RawWord> = [];
  let start = -1;
  let equals = -1;
  let quote: '"' | "'" | null = null;

  const finish = (end: number) => {
    if (start !== -1) {
      words.push({ raw: text.slice(start, end), equals: equals === -1 ? -1 : equals - start });
      start = -1;
      equals = -1;
    }
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quote === null && /\s/.test(ch)) {
      finish(i);
      continue;
    }
    if (start === -1) {
      start = i;
    }
    if (ch === "\\" && quote !== "'") {
      i++;
    } else if (quote !== null) {
      quote = ch === quote ? null : quote;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "=" && equals === -1) {
      equals = i;
    }
  }
  if (quote !== null) {
    return fail(`unterminated ${quote === '"' ? "double" : "single"} quote`);
  }
  finish(text.length);
  return { ok: true, value: words };
}

function readName(raw: string): Read<string> {
  const name = readValue(raw);
  return name.ok ? { ok: true, value: name.value.text } : name;
}

function readPair(word: RawWord, keyword: string): Read<Pair> {
  if (word.equals === -1) {
    return fail(`${keyword} ${word.raw} needs =value`);
  }
  const name = readName(word.raw.slice(0, word.equals));
  const value = readValue(word.raw.slice(word.equals + 1));
  if (!name.ok) {
    return name;
  }
  return value.ok ? { ok: true, value: { name: name.value, value: value.value } } : value;
}

function readAll<T>(
  words: ReadonlyArray<RawWord>,
  read: (word: RawWord) => Read<T>,
): Read<Array<T>> {
  const items: Array<T> = [];
  for (const word of words) {
    const item = read(word);
    if (!item.ok) {
      return item;
    }
    items.push(item.value);
  }
  return { ok: true, value: items };
}

/**
 * Split the arguments of ENV or LABEL into pairs. `name=value name2=value2` is the usual
 * form. `name value with spaces` is the legacy form: the value is the rest of the line.
 *
 * @param keyword - For messages
 * @param text - Arguments with `\` continuations joined
 */
export function splitPairs(keyword: string, text: string): Read<Array<Pair>> {
  const words = rawWords(text);
  if (!words.ok) {
    return words;
  }
  const [first] = words.value;
  if (first === undefined) {
    return fail(`${keyword} takes name=value pairs`);
  }
  if (first.equals !== -1) {
    return readAll(words.value, (word) => readPair(word, keyword));
  }

  const name = readName(first.raw);
  const rest = text.trim().slice(first.raw.length).trim();
  if (!name.ok || rest === "") {
    return name.ok ? fail(`${keyword} ${first.raw} needs a value`) : name;
  }
  const value = readValue(rest);
  return value.ok ? { ok: true, value: [{ name: name.value, value: value.value }] } : value;
}

/**
 * Split the arguments of ARG into names with an optional default: `NAME` or `NAME=default`.
 *
 * @param text - Arguments with `\` continuations joined
 */
export function splitArgs(text: string): Read<Array<Arg>> {
  const words = rawWords(text);
  if (!words.ok) {
    return words;
  }
  if (words.value.length === 0) {
    return fail("ARG takes names, with optional =default values");
  }
  return readAll(words.value, (word): Read<Arg> => {
    if (word.equals === -1) {
      const name = readName(word.raw);
      return name.ok ? { ok: true, value: { name: name.value, value: null } } : name;
    }
    return readPair(word, "ARG");
  });
}
