// Command parse reads a Dockerfile on stdin, parses it with BuildKit's own parser, and
// prints the result as JSON. tests/support/buildkit.ts runs it so tests can check that
// rendered output means what the model says, instead of relying on hand-written rules.
//
// Each instruction carries the parser's view (args, flags, heredocs) and, where BuildKit
// would expand variables, the typed command after expansion with an empty environment.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/moby/buildkit/frontend/dockerfile/instructions"
	"github.com/moby/buildkit/frontend/dockerfile/parser"
	"github.com/moby/buildkit/frontend/dockerfile/shell"
)

type heredoc struct {
	Name    string `json:"name"`
	Expand  bool   `json:"expand"`
	Content string `json:"content"`
}

type instruction struct {
	Cmd      string    `json:"cmd"`
	Args     []string  `json:"args"`
	Flags    []string  `json:"flags"`
	Heredocs []heredoc `json:"heredocs"`
	Comments []string  `json:"comments"`
	// Typed command (or stage, for FROM) after BuildKit's variable expansion, or null if
	// parsing it failed.
	Command any    `json:"command"`
	// The parsed --mount flags of a RUN, after variable expansion. BuildKit keeps them
	// outside the typed command, so they get their own field.
	Mounts []*instructions.Mount `json:"mounts"`
	Error  string                `json:"error,omitempty"`
}

type output struct {
	Instructions []instruction `json:"instructions"`
	Warnings     []string      `json:"warnings"`
}

type emptyEnv struct{}

func (emptyEnv) Get(string) (string, bool) { return "", false }
func (emptyEnv) Keys() []string            { return nil }

func main() {
	result, err := parser.Parse(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	lex := shell.NewLex(result.EscapeToken)
	expand := func(word string) (string, error) {
		expanded, _, err := lex.ProcessWord(word, emptyEnv{})
		return expanded, err
	}

	out := output{Instructions: []instruction{}, Warnings: []string{}}
	for _, w := range result.Warnings {
		out.Warnings = append(out.Warnings, w.Short)
	}

	for _, node := range result.AST.Children {
		ins := instruction{
			Cmd:      node.Value,
			Args:     []string{},
			Flags:    append([]string{}, node.Flags...),
			Heredocs: []heredoc{},
			Comments: append([]string{}, node.PrevComment...),
			Mounts:   []*instructions.Mount{},
		}
		for next := node.Next; next != nil; next = next.Next {
			ins.Args = append(ins.Args, next.Value)
		}
		for _, h := range node.Heredocs {
			ins.Heredocs = append(ins.Heredocs, heredoc{Name: h.Name, Expand: h.Expand, Content: h.Content})
		}

		// ParseInstruction returns a *Stage for FROM and a Command for everything else.
		cmd, err := instructions.ParseInstruction(node)
		if err == nil {
			if e, ok := cmd.(instructions.SupportsSingleWordExpansion); ok {
				err = e.Expand(expand)
			}
		}
		if err != nil {
			ins.Error = err.Error()
		} else {
			ins.Command = cmd
			if run, ok := cmd.(*instructions.RunCommand); ok {
				ins.Mounts = append(ins.Mounts, instructions.GetMounts(run)...)
			}
		}
		out.Instructions = append(out.Instructions, ins)
	}

	enc := json.NewEncoder(os.Stdout)
	if err := enc.Encode(out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
