import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * Capture the protocol version the server returned from initialize. The SDK's
 * `Client.connect()` forwards it to the transport's OPTIONAL
 * `setProtocolVersion` hook (a documented member of the `Transport` interface)
 * and otherwise discards it — `Client` has no getter, and the stdio transport
 * stores nothing. Installing the hook is therefore the only way to observe the
 * negotiated version without a second handshake.
 *
 * The hook CHAINS: any existing implementation (the HTTP transport uses it to
 * stamp subsequent request headers) is called through after recording, so a
 * future SDK that adds one to stdio keeps working. And going dead is LOUD: if
 * connect() completes without the SDK ever calling the hook, the getter throws
 * instead of returning undefined — an SDK-compatibility bug must fail the run,
 * not slip an empty field into results.
 */
export function captureNegotiatedProtocolVersion(
  transport: Transport,
  targetLabel: string,
): () => string {
  let negotiated: string | undefined;
  const existing = transport.setProtocolVersion?.bind(transport);
  transport.setProtocolVersion = (version: string) => {
    negotiated = version;
    existing?.(version);
  };
  return () => {
    if (negotiated === undefined) {
      throw new Error(
        `BUG: the MCP SDK completed the initialize handshake without reporting a negotiated ` +
          `protocol version (${targetLabel}). This vexyo build is incompatible with the ` +
          'installed @modelcontextprotocol/sdk version — please file an issue.',
      );
    }
    return negotiated;
  };
}
