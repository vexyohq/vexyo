/**
 * Broken fixture for the `initialization` rule family. The handshake completes
 * (so the harness connects), but the selected defect corrupts one piece of the
 * server's advertised identity. Runnable over stdio or HTTP via `serve`.
 *
 *   --defect name-empty          → serverInfo.name is ""
 *   --defect version-empty       → serverInfo.version is ""
 */
import { serve } from '@vexyo/fixture-support';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export function createServer(defect: string): Server {
  return new Server(
    {
      name: defect === 'name-empty' ? '' : 'vexyo-broken-init',
      version: defect === 'version-empty' ? '' : '1.0.0',
    },
    {
      capabilities: {},
      instructions: 'Broken initialization fixture.',
    },
  );
}

await serve(createServer);
