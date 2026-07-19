# @vexyo/reporters

Reporters for [vexyo](https://github.com/vexyohq/vexyo) MCP test runs: `console`, `json`, `junit`,
and `markdown` (PR-ready GitHub job summaries with a failures section and collapsed drift diffs).

Every reporter consumes the `RunResult` type only — adding a reporter never reaches into core
internals.

Part of the [vexyo](https://github.com/vexyohq/vexyo) monorepo. Apache-2.0.
