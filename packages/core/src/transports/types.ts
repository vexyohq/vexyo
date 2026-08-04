import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StderrSnapshot } from './stderr';

/** Which transport a connection uses, plus transport-specific facts rules may inspect. */
export type TransportInfo = { kind: 'stdio' } | { kind: 'http'; sessionId?: string };

/** How to spawn a stdio MCP server under test. */
export interface StdioTargetConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/** How to reach a running Streamable HTTP MCP server. */
export interface HttpTargetConfig {
  url: string;
  headers?: Record<string, string>;
}

/** A connection target: exactly one transport (CLAUDE.md hard rule #2 spirit). */
export type ConnectTarget =
  { transport: 'stdio'; stdio: StdioTargetConfig } | { transport: 'http'; http: HttpTargetConfig };

export interface ConnectedClient {
  client: Client;
  transport: TransportInfo;
  /**
   * Snapshot of the captured child-stderr tail (stdio only; absent for http).
   * Callable at any point, including after `close()`.
   */
  serverStderr?: () => StderrSnapshot;
  /** Closes the client connection (and, for stdio, the spawned server process). */
  close: () => Promise<void>;
}
