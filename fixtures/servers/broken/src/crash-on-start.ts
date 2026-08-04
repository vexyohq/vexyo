/**
 * A server whose entrypoint crashes before the MCP handshake — models a
 * third-party server with a broken import (e.g. an incompatible SDK major).
 * Writes a fake traceback to stderr and exits non-zero WITHOUT ever serving.
 *
 * `process.exitCode` (not `process.exit()`) on purpose: an immediate exit can
 * truncate async pipe-destined stderr; letting the event loop drain flushes it.
 */
process.stderr.write('Traceback (most recent call last):\n');
process.stderr.write('  File "/app/server.py", line 3, in <module>\n');
process.stderr.write('    from mcp.server.fastmcp import FastMCP\n');
process.stderr.write('  File "/app/.venv/lib/python3.12/site-packages/mcp/__init__.py", line 1\n');
process.stderr.write(
  "ImportError: cannot import name 'FastMCP' (incompatible mcp major version)\n",
);
process.exitCode = 1;
