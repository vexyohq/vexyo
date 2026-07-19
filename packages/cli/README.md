# @vexyo/cli

The `vexyo` command line: run conformance checks and record/diff regression golden sets against an
MCP server, over stdio or Streamable HTTP.

```bash
vexyo run --config vexyo.config.ts                              # conformance
vexyo record --config vexyo.config.ts                          # capture golden set
vexyo run --regression --config vexyo.config.ts --reporter markdown
```

Exit codes: `0` pass, `1` findings at/above the failure threshold, `2` harness/config error.

Part of the [vexyo](https://github.com/vexyohq/vexyo) monorepo. Apache-2.0.
