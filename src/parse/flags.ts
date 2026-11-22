// pattern: Functional Core

import { Result, err, ok } from "neverthrow";
import { type ValidationError, validationError } from "../errors.js";

/**
 * Read the `--name=value` flags of an instruction. Anything the model has no field for is an
 * error: a flag the instruction doesn't take, a repeated flag, one written with a space
 * (`--chown app:app`, where BuildKit reads `app:app` as a path), or a value with quotes or
 * a backslash, which BuildKit would unquote.
 *
 * @param keyword - For messages
 * @param flags - Flag words as written, such as `--chown=1:2`
 * @param allowed - Flag names the instruction takes, such as `--chown`
 * @returns Values by flag name, or one error per bad flag
 */
export function readFlags(
  keyword: string,
  flags: ReadonlyArray<string>,
  allowed: ReadonlyArray<string>,
): Result<Record<string, string>, Array<ValidationError>> {
  const values: Record<string, string> = {};
  const errors: Array<ValidationError> = [];

  for (const flag of flags) {
    const equals = flag.indexOf("=");
    const name = equals === -1 ? flag : flag.slice(0, equals);

    if (!allowed.includes(name)) {
      errors.push(validationError("flag", `${keyword} ${name} isn't supported`, flag));
    } else if (equals === -1) {
      errors.push(validationError("flag", `${name} needs a value, written ${name}=value`, flag));
    } else if (name in values) {
      errors.push(validationError("flag", `${keyword} ${name} is given more than once`, flag));
    } else if (/["'\\]/.test(flag)) {
      errors.push(validationError("flag", `${name} can't contain quotes or a backslash`, flag));
    } else {
      values[name] = flag.slice(equals + 1);
    }
  }

  return errors.length > 0 ? err(errors) : ok(values);
}
