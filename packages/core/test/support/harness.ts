import { type ChildProcess, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rule, RuleContext } from '../../src/rule';
import { runRules } from '../../src/runner';
import { connectTarget, type ConnectTarget } from '../../src/transports/index';
import type { RuleResult, SpecVersion } from '../../src/types';

const here = dirname(fileURLToPath(import.meta.url));
// packages/core/test/support -> repo root
const repoRoot = resolve(here, '../../../..');

export const SPEC: SpecVersion = '2025-11-25';
export type Transport = 'stdio' | 'http';
export type BrokenFamily = 'initialization' | 'discovery' | 'error-semantics';

const COMPLIANT_ENTRY = resolve(repoRoot, 'fixtures/servers/compliant/src/index.ts');
const brokenEntry = (family: BrokenFamily) =>
  resolve(repoRoot, `fixtures/servers/broken/src/${family}.ts`);

/** A ready-to-connect fixture and a `stop()` to release any spawned process. */
export interface Fixture {
  target: ConnectTarget;
  stop: () => Promise<void>;
}

/**
 * Prepare a fixture over the given transport. For stdio, the target spawns the
 * server on connect (nothing to stop). For http, the server process is spawned
 * now, its bound port is read from stdout, and `stop()` kills it — the runner
 * only owns the *connection*, mirroring how a real HTTP server is external.
 */
async function fixture(
  transport: Transport,
  entry: string,
  extraArgs: string[] = [],
): Promise<Fixture> {
  if (transport === 'stdio') {
    return {
      target: {
        transport: 'stdio',
        stdio: {
          command: process.execPath,
          args: ['--import', 'tsx', entry, ...extraArgs],
          cwd: repoRoot,
        },
      },
      stop: async () => undefined,
    };
  }

  const child = spawn(
    process.execPath,
    ['--import', 'tsx', entry, '--transport', 'http', '--port', '0', ...extraArgs],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const port = await readPort(child);
  return {
    target: { transport: 'http', http: { url: `http://127.0.0.1:${port}/mcp` } },
    stop: async () => {
      child.kill('SIGKILL');
    },
  };
}

export function compliantFixture(transport: Transport, extraArgs: string[] = []): Promise<Fixture> {
  return fixture(transport, COMPLIANT_ENTRY, extraArgs);
}

export function brokenFixture(
  transport: Transport,
  family: BrokenFamily,
  defect: string,
): Promise<Fixture> {
  return fixture(transport, brokenEntry(family), ['--defect', defect]);
}

/** Connect to a target over its transport, run a single rule, return its result. */
export async function runRule(rule: Rule, target: ConnectTarget): Promise<RuleResult> {
  const conn = await connectTarget(target);
  try {
    const ctx: RuleContext = {
      client: conn.client,
      serverInfo: conn.client.getServerVersion(),
      capabilities: conn.client.getServerCapabilities(),
      transport: conn.transport,
      specVersion: SPEC,
    };
    const [result] = await runRules(ctx, [rule]);
    if (!result) {
      throw new Error(`runRules returned no result for rule ${rule.id}`);
    }
    return result;
  } finally {
    await conn.close().catch(() => undefined);
  }
}

/** Resolve once the http fixture prints its bound port (see `serve`). */
function readPort(child: ChildProcess): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const stdout = child.stdout;
    if (!stdout) {
      reject(new Error('fixture child has no stdout to read the port from'));
      return;
    }
    let buffer = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('timed out waiting for fixture to report its port'));
    }, 10_000);

    stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const match = buffer.match(/VEXYO_PORT=(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolvePort(Number(match[1]));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`fixture exited before reporting a port (code ${code ?? 'null'})`));
    });
  });
}
