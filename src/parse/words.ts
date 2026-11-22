// pattern: Functional Core

export type Words =
  | { readonly ok: true; readonly words: Array<string> }
  | { readonly ok: false; readonly message: string };

/**
 * Split text into words the way a Dockerfile reads `VOLUME /a "/b c"`: whitespace separates
 * words, and quotes group characters and are removed. A backslash escapes the next character
 * outside quotes, and `\"` or `\\` inside double quotes.
 */
export function splitWords(text: string): Words {
  const words: Array<string> = [];
  let current: string | null = null;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const next = text.charAt(i + 1);

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        current = (current ?? "") + ch;
      }
    } else if (quote === '"') {
      if (ch === '"') {
        quote = null;
      } else if (ch === "\\" && (next === '"' || next === "\\")) {
        current = (current ?? "") + next;
        i++;
      } else {
        current = (current ?? "") + ch;
      }
    } else if (/\s/.test(ch)) {
      if (current !== null) {
        words.push(current);
        current = null;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current = current ?? "";
    } else if (ch === "\\" && next !== "") {
      current = (current ?? "") + next;
      i++;
    } else {
      current = (current ?? "") + ch;
    }
  }

  if (quote !== null) {
    return { ok: false, message: `unterminated ${quote === '"' ? "double" : "single"} quote` };
  }
  if (current !== null) {
    words.push(current);
  }
  return { ok: true, words };
}

/**
 * Read text as exec form: a JSON array of strings. Anything else is shell form, which is
 * how BuildKit treats `CMD ['a','b']` and `RUN [ -f /x ] && echo ok`.
 */
export function parseJsonStringArray(text: string): Array<string> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[")) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(trimmed);
    return Array.isArray(value) && value.every((item): item is string => typeof item === "string")
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * Split off the words at the start that look like flags (`--name=value`). BuildKit reads
 * flags only before the first other word.
 */
export function splitFlags(text: string): { readonly flags: Array<string>; readonly rest: string } {
  const flags: Array<string> = [];
  let rest = text.trimStart();
  for (let match = /^(--\S*)\s*/.exec(rest); match !== null; match = /^(--\S*)\s*/.exec(rest)) {
    flags.push(match[1] ?? "");
    rest = rest.slice(match[0].length);
  }
  return { flags, rest };
}
