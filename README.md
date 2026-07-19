# vexyo

CI-native conformance and regression testing for **Model Context Protocol (MCP)** servers —
spec-conformance rules, golden-set regression testing, and a low-noise security layer, runnable
locally and in CI as a CLI + GitHub Action.

> Automate what MCP Inspector makes you do by hand; stay current with every spec release.

## Quickstart

```bash
pnpm install
pnpm vexyo -- run --config examples/basic.config.ts   # conformance run over stdio
```

- **Reporters:** `--reporter console | json | junit | markdown`.
- **Regression:** `vexyo record` captures golden sets; `vexyo run --regression` fails on drift.
- **HTTP servers:** point a `{ transport: 'http', url }` target at a running server; sessions are
  handled by the transport.

## Packages

- [`@vexyo/core`](packages/core) — conformance/regression engine (rules, runner, transports, diffing).
- [`@vexyo/cli`](packages/cli) — the `vexyo` CLI.
- [`@vexyo/reporters`](packages/reporters) — console / json / junit / markdown reporters.
- [`@vexyo/action`](packages/action) — GitHub Action wrapping the CLI.

## Docs

Architecture decisions live in [`docs/decisions.md`](docs/decisions.md); documented spec
ambiguities in [`docs/spec-ambiguities.md`](docs/spec-ambiguities.md).

## License

[Apache-2.0](LICENSE).
