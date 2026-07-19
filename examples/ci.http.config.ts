import { defineConfig } from '@vexyo/cli/config';

// CI dogfooding config (Streamable HTTP). The workflow starts the compliant
// fixture as a background service on port 8765; vexyo only connects to it —
// the runner does not own that process (unlike stdio).
export default defineConfig({
  specVersion: '2025-11-25',
  target: {
    transport: 'http',
    url: 'http://127.0.0.1:8765/mcp',
  },
});
