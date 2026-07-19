import { McpError } from '@modelcontextprotocol/sdk/types.js';

/**
 * McpError formats its message as `MCP error <code>: <message>`. When such an
 * error round-trips over the wire (server formats it, the client re-wraps the
 * already-formatted string) the prefix doubles up:
 * `MCP error -32603: MCP error -32603: tools/list is broken`. Strip every
 * leading prefix so a finding carries one clean message.
 */
export function cleanErrorMessage(err: unknown): string {
  let message = err instanceof Error ? err.message : String(err);
  const prefix = /^MCP error -?\d+: /;
  while (prefix.test(message)) {
    message = message.replace(prefix, '');
  }
  return message;
}

/** The JSON-RPC error code, if the thrown value was an McpError. */
export function errorCode(err: unknown): number | undefined {
  return err instanceof McpError ? err.code : undefined;
}
