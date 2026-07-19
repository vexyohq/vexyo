# Spec Ambiguities

Places where the MCP spec permits more than one conformant behavior, and how
vexyo resolves them. Precision over recall (CLAUDE.md hard rule #4): when a
server picks any allowed alternative, we must not flag it.

Each entry: the ambiguity, the spec basis, and our decision.

---

## SA-0001 — Tool call errors: JSON-RPC error vs `isError` result

**Spec version:** 2025-11-25 · **Rules:** `errors/unknown-tool`, `errors/tool-invalid-params`

**Ambiguity.** When a `tools/call` fails (unknown tool name, or arguments that
don't satisfy the tool's `inputSchema`), a server may signal the failure two
ways: as a JSON-RPC error response, or as a successful result with
`isError: true`. The spec treats tool-execution problems as `isError` results
while protocol-level problems tend to be JSON-RPC errors, and the boundary is
not crisp — the official SDK's high-level server, for instance, returns invalid
tool arguments as an `isError` result, not a JSON-RPC error.

**Decision.** Both are accepted. `errors/unknown-tool` and
`errors/tool-invalid-params` pass if the server signals the failure _either_
way; they fail only on a plain success result with no error signal at all. The
narrower check "a JSON-RPC error object is well-formed" is handled separately by
`errors/error-object-shape`, which triggers a guaranteed JSON-RPC error
(reading an unknown resource) rather than relying on tool-call error style.
