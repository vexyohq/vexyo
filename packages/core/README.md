# @vexyo/core

Conformance and regression engine for [vexyo](https://github.com/vexyohq/vexyo) — testing Model
Context Protocol (MCP) servers.

Defines the `Rule` abstraction, the `Runner` (which owns the connection lifecycle over stdio and
Streamable HTTP), the `RunResult` contract that reporters consume, and the golden-set regression
engine (record + drift detection with deterministic, Prettier-stable goldens). Built on the
official `@modelcontextprotocol/sdk`.

Part of the [vexyo](https://github.com/vexyohq/vexyo) monorepo. Apache-2.0.
