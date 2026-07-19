# vexyo GitHub Action

Run [vexyo](https://github.com/vexyohq/vexyo) MCP conformance and regression checks in CI: fails the
job on findings, annotates the PR, and publishes a markdown report as the job summary.

```yaml
- uses: vexyohq/vexyo/packages/action@v1
  with:
    config: vexyo.config.ts
    spec-version: 2025-11-25
    # regression: true
    # fail-on: error
    # junit-file: vexyo-junit.xml
```

Inputs: `config` (required), `spec-version`, `regression`, `fail-on`, `junit-file`. The action runs
its committed bundle (`dist/index.cjs`); pin it by git ref for reproducible runs.

Part of the [vexyo](https://github.com/vexyohq/vexyo) monorepo. Apache-2.0.
