/**
 * Thrown when the target server cannot be reached at all — the stdio child
 * failed to start (or died during the handshake), or the HTTP endpoint is
 * unreachable. Deliberately distinct from config errors: the fix-owner is the
 * TARGET, not the vexyo invocation, and the CLI maps this to exit code 3
 * (config/harness errors stay 2). Carries the captured child stderr — for a
 * crashed stdio server it is the only diagnostic available.
 */
export class TargetConnectionError extends Error {
  readonly transport: 'stdio' | 'http';
  /** Human-readable target (e.g. `stdio: node server.js`, `http: <url>`). */
  readonly targetDescription: string;
  /** Captured child stderr tail; always '' for http targets. */
  readonly stderr: string;
  readonly truncated: boolean;

  constructor(options: {
    message: string;
    transport: 'stdio' | 'http';
    targetDescription: string;
    stderr: string;
    truncated: boolean;
    cause?: unknown;
  }) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'TargetConnectionError';
    this.transport = options.transport;
    this.targetDescription = options.targetDescription;
    this.stderr = options.stderr;
    this.truncated = options.truncated;
  }
}
