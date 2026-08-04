/**
 * Bounded capture of a child server's stderr. Keeps only the LAST `capBytes`
 * (the interesting part — tracebacks and fatal errors come at the end), so a
 * chatty server cannot exhaust memory. Trimming is byte-based: a snapshot may
 * begin mid-UTF-8-codepoint (at most one replacement character) — accepted
 * rather than engineered around.
 */

export const STDERR_CAP_BYTES = 64 * 1024;

export interface StderrSnapshot {
  text: string;
  /** True when older output was dropped to stay within the cap. */
  truncated: boolean;
}

export interface StderrTail {
  append(chunk: Buffer | string): void;
  snapshot(): StderrSnapshot;
}

export function createStderrTail(capBytes: number = STDERR_CAP_BYTES): StderrTail {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;

  return {
    append(chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
      chunks.push(buf);
      total += buf.length;
      while (total > capBytes) {
        const first = chunks[0];
        if (!first) {
          break;
        }
        const overshoot = total - capBytes;
        if (first.length <= overshoot) {
          chunks.shift();
          total -= first.length;
        } else {
          chunks[0] = first.subarray(overshoot);
          total -= overshoot;
        }
        truncated = true;
      }
    },
    snapshot() {
      return { text: Buffer.concat(chunks).toString('utf8'), truncated };
    },
  };
}
