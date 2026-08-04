# @vexyo/cli

The `vexyo` command line: run conformance checks and record/diff regression golden sets against an
MCP server, over stdio or Streamable HTTP.

```bash
vexyo run --config vexyo.config.ts                              # conformance
vexyo record --config vexyo.config.ts                          # capture golden set
vexyo run --regression --config vexyo.config.ts --reporter markdown
```

Exit codes:

| Code | Meaning                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------- |
| `0`  | All checks passed.                                                                                       |
| `1`  | Findings at/above the failure threshold.                                                                 |
| `2`  | vexyo/config error — fix your config or invocation.                                                      |
| `3`  | The **target** server failed to start (stdio) or was unreachable (HTTP). Its captured stderr is printed. |

Note the HTTP distinction: an **unreachable** HTTP target (server down, wrong port) is `3` —
the target's fault — while a **malformed URL** in the config is `2`, a config mistake.
By default the target's stderr is captured, not shown; pass `--verbose` to print it after
the report. On exit `3` it is always printed.

Part of the [vexyo](https://github.com/vexyohq/vexyo) monorepo. Apache-2.0.
