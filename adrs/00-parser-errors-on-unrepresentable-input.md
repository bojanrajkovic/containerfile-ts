# 00. The parser errors on input the model can't represent

## Status

Accepted

## Context

`parse()` turns Dockerfile text into the same `Containerfile` that the factories build. The model
is smaller than the Dockerfile language. It has no type for ONBUILD or STOPSIGNAL, no field for
`COPY --link`, and one quoted form of heredoc. It also forgets formatting: spacing, keyword case,
and the original heredoc delimiter.

A parser can handle input outside the model in three ways: drop it, rewrite it into something the
model holds, or return an error.

## Decision

`parse()` returns a `ParseError`, with the line number, for anything the model can't represent.
It normalizes what the model holds but doesn't mean differently:

- Keywords render in upper case, with one space between words.
- Blank-line blocks become groups, and `render()` writes them back as blank lines.
- A heredoc gets a delimiter derived from its body.
- A redundant `# escape=\` directive is dropped.

`render(parse(text))` is therefore a normal form of the same Dockerfile, and
`parse(render(containerfile))` keeps every instruction.

## Why

Dropping a flag or an instruction changes what the build does. `RUN --mount=type=cache` without
its mount still builds, slower, and `ONBUILD` without its trigger builds an image that no longer
runs the trigger. Rewriting has the same problem: an unquoted heredoc expands `$VAR` and a quoted
one doesn't, so converting one to the other changes the script.

An error is visible and fixable. The caller can edit the Dockerfile, or wait for the model to
grow. Each error names the line, and parsing continues, so one run reports every problem.

## Consequences

- Real Dockerfiles that use unsupported features don't parse until the model supports them. Each
  feature added to the model removes one error.
- Tests compare `parse()` against BuildKit's own parser, because the contract is what BuildKit
  reads, not what we think a Dockerfile means.
- `dockerfile-ast` finds instruction boundaries only. It accepts malformed input without
  complaint, and its argument values ignore quotes, so all validation and value parsing is ours.
