# Architecture Decision Log

Append-only. Each entry: what / why / alternatives. Newest last.

---

## ADR-0001 — M0 skeleton structure

**Date:** 2026-07-18 · **Milestone:** M0

- **What:** pnpm monorepo — `core` (Rule/Runner/RunResult seams), `cli`, `reporters`, and `fixtures/servers/compliant`; the official `@modelcontextprotocol/sdk` owns transport + handshake; tests run on vitest against a locally-spawned stdio fixture (no network).
- **Why:** M0's product is the interface set later milestones extend, so the `Rule`→`Runner`→`RunResult` boundary and one compliant fixture matter more than rule breadth; the SDK keeps us on-spec (its newest protocol version is exactly our `2025-11-25` target).
- **Alternatives:** hand-rolled JSON-RPC client (rejected — reinvents the handshake, drifts from spec; reserved only for future malformed-frame probes); mocked/in-process servers for tests (rejected — real stdio spawn is the behavior we ship and dogfood).

---

## ADR-0002 — M1 conformance strategy

**Date:** 2026-07-18 · **Milestone:** M1

- **What:** 15 rules (initialization/discovery/error-semantics) each fetch raw responses via the SDK client's low-level `request(req, laxSchema)` and validate fields/`McpError.code` themselves; the compliant fixture passes all 15; broken fixtures are one low-level `Server` per family that injects a single surgical defect chosen by `--defect <id>`. Added `zod ^4` to core; JSON reporter added.
- **Why:** the high-level SDK client strict-parses and normalizes responses, hiding exactly what conformance must inspect — so rules read raw payloads (still 100% official SDK, no hand-rolled framing) while a per-family defect server proves each rule fails on a dedicated broken fixture (hard rule #3) without duplicating a server per rule.
- **Alternatives:** rely on the SDK's strict result schemas to define conformance (rejected — makes malformed entries a parse crash, not a precise finding); one broken server per rule (rejected — heavy duplication); dropped `init/instructions-non-empty` (the SDK server silently omits an empty `instructions`, making the defect unreachable and the rule effectively untestable) in favor of `discovery/resources-have-uri`.

---

## ADR-0003 — M2 regression / golden sets

**Date:** 2026-07-18 · **Milestone:** M2

- **What:** golden format v1 (`manifest.json` + `recordings/<tool>.json`, `formatVersion: 1`, all writes through `stableStringify` — which sorts keys and emits **Prettier-stable** JSON, mirroring Prettier's flat/break/"table" layout so committed goldens survive `prettier --check` in users' repos byte-identically — zod-validated on read); `record` (opt-in per tool — nothing is called unless listed) and `run --regression`; three drift classes — schema/behavioral/coverage — emitted as `regression`-category `RuleResult`s carrying a typed `RegressionDetail` in `Finding.detail`; builtin + inline-custom normalizers with `suggestNormalizer` guidance; markdown reporter; a defect-parameterized `regression.ts` fixture. Added `warn` to `RuleStatus`/`RunSummary` and a `failOn` threshold.
- **Why:** goldens are a public contract the instant they're committed, so determinism is designed in from v1 (retrofitting it later would be breaking — hard rule #6). Drift rides the existing findings/exit-code/reporter machinery, so no bespoke `RunResult.regression` subtree; the one additive contract change (`warn`) exists because regression is the first check that legitimately warns (a new uncovered tool shouldn't break CI).
- **Alternatives:** extend `RunResult` with a typed `regression` tree (rejected — keeps the contract frozen; `Finding.detail` + an exported schema suffices); one broken server per drift class (rejected — a single `--defect` fixture keeps the baseline and drift servers in sync); freeze the contract and make every drift `error` (rejected — worse DX; `warn`/`failOn` gives coverage-of-new-tool the right non-failing severity). Deferred: `sort-arrays` ordering normalizer (value normalizers ship; ordering normalizer is lower-value and parametric — later).

---

## ADR-0004 — M3 Streamable HTTP, GitHub Action, junit

**Date:** 2026-07-18 · **Milestone:** M3

- **What:** Streamable HTTP transport (`connectHttp` + a `connectTarget` dispatcher); the runner owns only the _connection_ (the SDK client transport owns the session), and `RuleContext` gains a `transport` struct. Fixtures run over stdio or HTTP via a shared `serve` helper (`@mcpharness/fixture-support`, stateful HTTP with `enableJsonResponse`). The full 15-rule set runs over both transports as a `describe.each` matrix; one transport-specific rule `transport/http-session-id-valid` (+ `--http-defect bad-session-id` fixture pair). A node20 GitHub Action wraps the CLI's extracted `executeRun`, publishing the markdown report to the job summary and emitting PR annotations; a `junit` reporter; dogfood CI runs the Action over both transports on every PR (release-blocking).
- **Why:** rules already act only on `ctx.client`, so HTTP is a connect-layer swap and rules stay transport-agnostic — the matrix is a test dimension, not a fork. A node20 action (not composite) is needed for zod-validated inputs, a structured `RunResult` → job summary/annotations, and testable pure logic. The Action reuses `executeRun` rather than duplicating orchestration.
- **Alternatives / named compromises:** most HTTP semantics (origin/host, protocol-version header, 405, DELETE) are SDK-enforced on both ends → not testable via a broken fixture without hand-rolling a non-SDK server, so deferred (one high-precision rule instead — hard rule #4). Dropped `@actions/github` (unused — `@actions/core` annotations suffice). **jiti does not survive esbuild bundling**, so it is marked `--external:jiti` and declared an Action dependency (resolved from `node_modules` at runtime) — the Action is therefore not fully standalone pre-publish. Pre-publish reality: dogfood uses `uses: ./packages/action` (local path, rebuilt each run) and configs that spawn our TS fixtures via tsx; the published-`@v1` / `npx mcpharness@<version>` path is post-M3. Version pinning: users pin the Action git ref, which freezes the CLI/core bundled into that release's committed `dist/index.cjs` (`.gitignore` exception tracks it; linters ignore `**/dist/**`).

---

## ADR-0005 — Rule-dependency skip semantics

**Date:** 2026-07-18 · **Milestone:** post-M3 polish

- **What:** rules that consume a list operation (`tools/list` / `resources/list` / `prompts/list`) now **skip with a reason** ("tools/list unavailable") when that operation fails, instead of throwing and being recorded as `error`. `RuleResult` gains an optional `skipReason`; the runner captures `SkipRule.reason`; console/json/junit/markdown render skip-with-reason distinctly. A single broken `tools/list` now reads as **one failure** (from `discovery/tools-list-available`, which directly tests it) **plus N skips**, not one failure plus four errors. (Companion commit: collapse doubled `MCP error <code>:` prefixes so findings carry one clean message.)
- **Why:** a red PR should communicate the root cause once — "tools/list is broken" — with dependents visibly skipped because of it, not four identical "Rule threw an unexpected error" lines that bury the signal (north-star: signal quality).
- **Semver implication (flagged):** this **changes the meaning of `RunResult`**. `skip` now covers two cases (not-applicable _and_ prerequisite-unavailable), and results that were previously `error` are now `skip` — so consumers that count `summary.error`, or treat every skip as "not applicable", will observe different numbers. The new field (`skipReason`) is additive, but the status reclassification is a behavioral change: **minor with a documented semantic shift**, and semver-major for anyone asserting on error counts. Likewise the message cleanup changes finding `message` text, which anyone snapshotting exact messages (e.g. JSON reporter output) would see diff.
- **Alternatives:** a formal `dependsOn` field per rule + a runner dependency graph (rejected — heavier than warranted; the list operations are the only real dependency today, and a shared accessor that skips-on-failure captures it precisely). Leaving dependents as errors (rejected — that noise is exactly what this change removes).

---

## ADR-0006 — Rename to vexyo; publish build deferred

**Date:** 2026-07-19 · **Milestone:** naming / pre-publish

- **What:** the placeholder name "mcpharness" is now the final name **vexyo**. Renamed everywhere — packages `@vexyo/*`, CLI command `vexyo`, the `BRAND` constant, fixture server names, the `vexyo://` resource URI, `VEXYO_PORT`/`VEXYO_READY` markers, and the `vexyo/probe-unsupported-method` probe — re-recorded the golden set and rebuilt the committed Action bundle so no stale `mcpharness` strings remain (verified by grep). Added an Apache-2.0 `LICENSE`, per-package metadata (description/keywords/repository/homepage/license), and READMEs. Earlier ADRs (0001–0005) intentionally keep the old name for historical accuracy.
- **Why:** the name is locked and the `@vexyo` npm scope + domains are being claimed; get pre-publish hygiene in place now without a risky build change.
- **Deferred (flagged):** the actual publish build — emitted `dist` (tsup or `tsc` composite), `exports` dev/default conditions (`development → src`, `default → dist`), `files: ["dist"]`, `publishConfig`, and flipping `private` off — is a separate **publish-prep PR**. Until then every package stays `private: true` (an accidental-publish guard) and source-first per ADR-0001; nothing publishes yet. Doing the emit change inside the rename would risk the run-from-source dev flow (tests/tsx/dogfood) for no near-term benefit.

---

## ADR-0007 — Publish build: tsup dist emit behind a `development` export condition

**Date:** 2026-07-19 · **Milestone:** publish-prep

- **What:** `@vexyo/core|cli|reporters` are now npm-publishable. Each emits ESM `dist` + `.d.ts` via **tsup** (deps + workspace `@vexyo/*` external), with `private: false`, `files: ["dist"]`, `bin → dist`, and `publishConfig` (`access: public` + dist-only `exports`). A **tag-driven `release.yml`** (`on: push tags v*`) type-checks, runs the full test suite, sets every package's version from the tag, builds dist, runs `publint`, and `pnpm publish -r --access public --provenance --no-git-checks` with `NPM_TOKEN`. `action` + fixtures stay `private`.
- **Why source-first dev survives:** the package `exports` carry a **`development` condition → `./src/*.ts`** that dev tools activate — `tsc` via `customConditions: ["development"]`, `pnpm vexyo` via `node --conditions=development`, the Action's esbuild via `--conditions=development`, and vitest via its existing `resolve.alias`. So `pnpm build` + `pnpm test` (100 tests) stay green with **no emitted dist**; only npm consumers (and `publint`'s pack) fall through to `dist`. `publishConfig.exports` strips the `development` condition from the published manifest so consumers never see a pointer to unshipped `src`.
- **Guarantees:** the release runs `pnpm build` + `pnpm test` **before** publish — a red suite can never ship. `workspace:*` deps are rewritten to the exact `$VERSION` in the tarballs (asserted in the PR: a packed `@vexyo/cli` shows `"@vexyo/core": "<version>"`, never `workspace:*` or `0.0.0`).
- **Semantics change (flagged):** consumers now receive compiled `dist` JS + `.d.ts` (previously the packages exported TypeScript source); `main`/`types`/`exports` point at `dist`.
- **Alternatives:** `tsc` composite emit (rejected — our extensionless bundler-style imports aren't rewritten by `tsc` emit, so runtime imports would break; tsup bundles them). Shipping `src` in `files` to satisfy the `development` condition (rejected — defeats "dist only"; `publishConfig.exports` is the correct strip).

---

## ADR-0008 — Path-scoped normalizers and ignored paths

**Date:** 2026-08-04 · **Milestone:** post-launch (issue #5)

- **What:** the regression pipeline gains two path-scoped stages on top of the existing whole-tree normalizers: `paths` (a normalizer — builtin or custom — applied only to the subtree at a JSON path) and `ignore` (paths excluded from comparison). Config keys exist at the `regression` level (defaults) and per `record.<tool>` entry (which **replace** the defaults per key, the same `??` semantics `normalizers` always had). The path grammar (`packages/core/src/golden/path.ts`) is dot keys + `[N]` + `[*]` array wildcard — **deliberately identical to the `FieldDiff.path` grammar the drift reporter prints**, so a path can be copied from a drift report straight into config, and it is reused as-is by the planned `sort-arrays` normalizer (issue #6). Pipeline order is fixed: whole-tree → path-scoped (declaration order) → ignores **last**, which makes "ignored beats normalized" a structural guarantee. Golden format is untouched (no version bump): `GoldenCase.normalizers` stays a human-reference `string[]`, now carrying entries like `'uuid @ items[*].id'` / `'ignore @ meta.elapsedMs'`.
- **Ignore mechanism:** an ignored subtree is replaced with the literal string `"<ignored>"` on **both** sides, at record and compare time — not skipped inside the differ. Consequences, all intended: goldens stay byte-stable across re-records (no git churn from volatile ignored fields, keeping the golden-diff-in-PR review flow readable), array indices never shift (deletion would shift them), structural changes under an ignored path are suppressed as one collapsed value, and ignored fields can never reach `suggestNormalizer`. Known limit (documented, not fixed): an array **length** change _above_ a scoped path still drifts, because `diffValue` only recurses equal-length arrays — that is real structural drift and should surface.
- **Semantics change (flagged):** compare now applies the pipeline to **both** the stored golden result and the live output (previously live only). All six builtins are idempotent (no placeholder re-matches any builtin pattern; the epoch builtins replace numbers with strings), so this is invisible for unchanged configs — but it makes a normalizer or ignore added _after_ recording apply without a re-record, which is what the documented "fix the normalizer, don't re-record" philosophy always promised. New contract: **custom `{ name, apply }` normalizers must be idempotent**, since they now re-run against already-normalized goldens on every compare (noted in the init scaffold; unenforceable). Corollary: removing an ignore rule leaves `"<ignored>"` in the golden and drifts until re-record — correct, since the field's history is genuinely gone.
- **Alternatives:** ignore as a diff-time path filter (rejected — leaves volatile values in committed goldens, churning every re-record, and can't suppress structural changes); a deep wildcard `**` and quoted keys for `.`/`[` in key names (deferred — the whole-result custom normalizer already covers both, and every added grammar form is future compat surface); a JSONPath library (rejected — the grammar must match `diffValue` output exactly, and a dependency would allow paths the reporter never prints).
